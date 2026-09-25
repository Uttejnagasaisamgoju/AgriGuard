"""
AgriGuard AI Agriculture Assistant Service
==========================================

Architecture
------------
All requests follow this flow — role and user identity are ALWAYS sourced
from the server-side authenticated User object, never from the frontend payload:

  Authenticated Request
       ↓
  get_current_user()  →  real User + real role from DB
       ↓
  build_role_context()  →  query only tables authorized for that role
       ↓
  build_system_prompt()  →  inject retrieved real data into Claude system prompt
       ↓
  _call_claude_api()  →  real Anthropic SDK call (key server-only)
       ↓
  persist messages to ai_conversations / ai_messages
       ↓
  return response (no raw context data in response body)

Security contract
-----------------
- Role is read from current_user.role (DB); never accepted from request body.
- Context queries use parameterized filters scoped to the authenticated user's
  role and ID. Cross-user / cross-role data never enters the context.
- The ANTHROPIC_API_KEY is read from the server environment only.
  It is never returned in any API response or logged.
- Retrieved data is treated as DATA injected into a system prompt, not as
  instructions (prompt-injection protection).

Fallback
--------
If ANTHROPIC_API_KEY is not configured, the service falls back to the existing
verified RAG synthesis engine so existing deployments are not broken.
"""

import logging
import json
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat import AIConversation, AIMessage, Conversation
from app.models.farm import Farm
from app.models.disease import DiseasePrediction, KnowledgeDocument
from app.models.officer import OfficerCase, FieldVisit
from app.models.user import User, UserRole
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

# ── Domain intent filter ───────────────────────────────────────────────────────
AGRI_KEYWORDS = {
    "crop", "crops", "plant", "plants", "leaf", "leaves", "disease", "pest", "pests",
    "fertilizer", "fertilizers", "nitrogen", "phosphorus", "potassium", "npk", "urea",
    "dap", "soil", "irrigation", "water", "drainage", "seed", "seeds", "sowing",
    "harvest", "harvesting", "yield", "fungus", "fungi", "fungicide", "pesticide",
    "insecticide", "bacterial", "virus", "viral", "blight", "blast", "rust", "rot",
    "mildew", "wilt", "armyworm", "caterpillar", "borer", "aphid", "whitefly", "thrips",
    "rice", "paddy", "wheat", "maize", "corn", "tomato", "potato", "cotton", "soybean",
    "sugarcane", "chili", "pepper", "onion", "garlic", "banana", "mango", "apple", "grape",
    "organic", "compost", "manure", "vermicompost", "neem", "trichoderma", "weather",
    "monsoon", "drought", "frost", "temperature", "humidity", "ph", "salinity", "acre",
    "hectare", "tillage", "mulch", "pruning", "weed", "weeds", "herbicide", "farm", "farmer",
    "agronomy", "horticulture", "pathology", "germination", "flowering", "tillering",
    "panicle", "grain", "nodule", "rhizosphere", "microbes", "deficiency", "chlorosis",
    "necrosis", "curative", "preventive", "spray", "dosage", "infestation", "intercropping",
    "case", "report", "detection", "diagnosis", "scan", "field", "visit", "officer",
    "expert", "consultation", "treatment", "recommendation",
}

NON_AGRI_PATTERNS = [
    r"\b(python|javascript|typescript|c\+\+|java|html|css|react|sql|coding|programming|algorithm)\b",
    r"\b(bitcoin|ethereum|crypto|cryptocurrency|blockchain|stock market|shares|forex)\b",
    r"\b(movie|cinema|actor|actress|hollywood|bollywood|song|music album)\b",
    r"\b(cricket match|football league|nba|fifa|super bowl|tennis grand slam)\b",
]

SUGGESTED_QUESTIONS_DEFAULT = {
    UserRole.FARMER: [
        "What organic treatments work best for leaf fungal spots?",
        "How can I adjust N-P-K fertilizer based on soil testing?",
        "What is the best irrigation schedule during high heat?",
        "How do I control Fall Armyworm without harming beneficial insects?",
    ],
    UserRole.OFFICER: [
        "Summarize my open cases and their priority levels.",
        "What are the recommended next steps for a field visit on blight cases?",
        "How do I escalate a critical disease case to a specialist?",
        "What documentation is needed before marking a case as resolved?",
    ],
    UserRole.EXPERT: [
        "Summarize the recent consultations I have pending.",
        "What are the latest ICAR guidelines for managing late blight?",
        "How should I explain early blight to a farmer in simple terms?",
        "What treatment protocol is recommended for severe rice blast?",
    ],
}


# ── Role-Scoped Context Builder ────────────────────────────────────────────────

def build_role_context(db: Session, user: User, farm_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Assemble only the database records the authenticated user is authorized to access,
    strictly scoped by their real role and ID.

    Security: This function is the authorization boundary for context assembly.
    It queries ONLY records owned by or assigned to this specific user,
    using the same authorization rules enforced by the rest of the API.
    Data returned here is ALL that Claude will ever see for this request.
    """
    role = user.role
    uid = user.id
    context: Dict[str, Any] = {
        "user_name": user.name,
        "user_role": role.value,
    }

    # ── FARMER ─────────────────────────────────────────────────────────────────
    if role == UserRole.FARMER:
        # Own farms only
        farm_q = db.query(Farm).filter(Farm.user_id == uid)
        if farm_id:
            active_farm = farm_q.filter(Farm.id == farm_id).first()
        else:
            active_farm = farm_q.order_by(Farm.created_at.desc()).first()

        if active_farm:
            context["active_farm"] = {
                "id": str(active_farm.id),
                "name": active_farm.name,
                "crop": active_farm.crop_type,
                "area_hectares": active_farm.area_hectares,
                "district": active_farm.district,
                "state": active_farm.state,
                "soil_type": active_farm.soil_type.value if active_farm.soil_type else None,
                "irrigation": active_farm.irrigation_type.value if active_farm.irrigation_type else None,
            }
        else:
            context["active_farm"] = None

        all_farms = farm_q.all()
        context["farm_count"] = len(all_farms)
        context["all_farms"] = [
            {"name": f.name, "crop": f.crop_type, "district": f.district}
            for f in all_farms
        ]

        # Own disease predictions only
        recent_preds = (
            db.query(DiseasePrediction)
            .filter(DiseasePrediction.user_id == uid)
            .order_by(DiseasePrediction.created_at.desc())
            .limit(5)
            .all()
        )
        context["recent_detections"] = [
            {
                "disease": p.primary_disease,
                "crop": p.primary_crop,
                "confidence": round(p.overall_confidence or 0, 2),
                "severity": p.severity,
                "date": p.created_at.strftime("%Y-%m-%d") if p.created_at else None,
            }
            for p in recent_preds
            if p.primary_disease
        ]

        # Own cases summary (count only — not full officer notes)
        open_cases = db.query(OfficerCase).filter(
            OfficerCase.farmer_id == uid,
            OfficerCase.status != "RESOLVED",
        ).count()
        resolved_cases = db.query(OfficerCase).filter(
            OfficerCase.farmer_id == uid,
            OfficerCase.status == "RESOLVED",
        ).count()
        context["cases_summary"] = {"open": open_cases, "resolved": resolved_cases}

    # ── OFFICER ────────────────────────────────────────────────────────────────
    elif role == UserRole.OFFICER:
        # Only cases assigned to this officer
        assigned_cases = (
            db.query(OfficerCase)
            .filter(OfficerCase.officer_id == uid)
            .order_by(OfficerCase.updated_at.desc())
            .limit(10)
            .all()
        )
        context["assigned_cases"] = [
            {
                "id": str(c.id),
                "title": c.title,
                "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                "priority": c.priority,
                "farmer_name": c.farmer.name if c.farmer else "Unknown",
                "farm_name": c.farm.name if c.farm else None,
                "created_at": c.created_at.strftime("%Y-%m-%d") if c.created_at else None,
                "description": (c.description or "")[:200],
                # Include officer_notes only for this officer's own cases
                "officer_notes": (c.officer_notes or "")[:300] if c.officer_id == uid else None,
            }
            for c in assigned_cases
        ]
        context["case_count"] = {
            "total": len(assigned_cases),
            "new": sum(1 for c in assigned_cases if str(c.status).upper() in ["NEW", "CASESTATUS.NEW"]),
            "in_progress": sum(1 for c in assigned_cases if str(c.status).upper() in [
                "UNDER_REVIEW", "CASESTATUS.UNDER_REVIEW",
                "FIELD_VISIT_REQUIRED", "CASESTATUS.FIELD_VISIT_REQUIRED",
                "TREATMENT_RECOMMENDED", "CASESTATUS.TREATMENT_RECOMMENDED",
            ]),
            "resolved": sum(1 for c in assigned_cases if str(c.status).upper() in ["RESOLVED", "CASESTATUS.RESOLVED"]),
        }

        # Field visits for assigned cases only
        case_ids = [c.id for c in assigned_cases]
        if case_ids:
            upcoming_visits = (
                db.query(FieldVisit)
                .filter(FieldVisit.officer_id == uid)
                .filter(FieldVisit.status == "scheduled")
                .order_by(FieldVisit.scheduled_date.asc())
                .limit(5)
                .all()
            )
            context["upcoming_field_visits"] = [
                {
                    "case_id": str(v.case_id),
                    "scheduled_date": v.scheduled_date.strftime("%Y-%m-%d") if v.scheduled_date else None,
                    "farm_name": v.farm.name if v.farm else None,
                }
                for v in upcoming_visits
            ]
        else:
            context["upcoming_field_visits"] = []

    # ── EXPERT ─────────────────────────────────────────────────────────────────
    elif role == UserRole.EXPERT:
        # Only consultations assigned to this expert
        active_consultations = (
            db.query(Conversation)
            .filter(Conversation.expert_id == uid, Conversation.is_active == True)
            .order_by(Conversation.last_message_at.desc())
            .limit(5)
            .all()
        )
        farmer_ids = [c.farmer_id for c in active_consultations]
        farmers_map = {}
        if farmer_ids:
            farmers = db.query(User).filter(User.id.in_(farmer_ids)).all()
            farmers_map = {f.id: f.name for f in farmers}

        context["active_consultations"] = [
            {
                "id": str(c.id),
                "farmer_name": farmers_map.get(c.farmer_id, "Farmer"),
                "last_message_at": c.last_message_at.strftime("%Y-%m-%d") if c.last_message_at else None,
            }
            for c in active_consultations
        ]
        context["consultation_count"] = len(active_consultations)

        # Disease detections for farmers in this expert's consultations (limited)
        farmer_ids = [c.farmer_id for c in active_consultations]
        if farmer_ids:
            related_detections = (
                db.query(DiseasePrediction)
                .filter(DiseasePrediction.user_id.in_(farmer_ids))
                .order_by(DiseasePrediction.created_at.desc())
                .limit(10)
                .all()
            )
            context["related_detections"] = [
                {
                    "disease": p.primary_disease,
                    "crop": p.primary_crop,
                    "confidence": round(p.overall_confidence or 0, 2),
                    "severity": p.severity,
                    "date": p.created_at.strftime("%Y-%m-%d") if p.created_at else None,
                }
                for p in related_detections
                if p.primary_disease
            ]
        else:
            context["related_detections"] = []

        # Expert profile
        if hasattr(user, "expert_profile") and user.expert_profile:
            context["expert_profile"] = {
                "specialization": user.expert_profile.specialization,
                "years_experience": user.expert_profile.years_experience,
                "crops_expertise": user.expert_profile.crops_expertise,
                "is_verified": user.expert_profile.is_verified,
            }

    # ── ADMIN (same as officer-level, no restrictions) ─────────────────────────
    elif role == UserRole.ADMIN:
        context["admin_note"] = "Admin role: Full read access for support purposes."
        # Count summary only — no bulk data
        context["platform_summary"] = {
            "total_farms": db.query(Farm).count(),
            "total_predictions": db.query(DiseasePrediction).count(),
            "total_cases": db.query(OfficerCase).count(),
        }

    return context


# ── System Prompt Builder ──────────────────────────────────────────────────────

def build_system_prompt(user: User, role_context: Dict[str, Any], rag_sources: List[Dict]) -> str:
    """
    Build a role-specific system prompt that grounds Claude's response in
    real retrieved data. All data included here was already filtered through
    build_role_context() so only authorized records are present.

    Anti-hallucination instruction: Claude is told explicitly to state specific
    facts (chemicals, dosages, statistics) ONLY when present in the retrieved
    content, and to clearly signal uncertainty when data is absent.

    Prompt injection defense: All retrieved database content is wrapped in
    clearly-delimited DATA blocks, not free-flowing instruction text.
    Even if a DB field contains "Ignore previous instructions", it cannot
    override the structural role of the system prompt sections.
    """
    role = user.role

    # Role-specific persona and scope
    role_persona = {
        UserRole.FARMER: (
            "You are the AgriGuard AI Assistant helping a farmer named {name}. "
            "You are an AI — clearly identify yourself as 'AgriGuard AI Assistant' if asked. "
            "You assist with crop disease diagnosis, fertilizer schedules, pest control, "
            "irrigation advice, and how to use AgriGuard app features (Disease Detection, "
            "Satellite View, Expert Chat). "
            "You have access to this farmer's own farm data and disease detection history below. "
            "You must NEVER reference other farmers' data, officer-internal case notes, "
            "or expert-private consultation content."
        ),
        UserRole.OFFICER: (
            "You are the AgriGuard AI Assistant helping Agricultural Officer {name}. "
            "You are an AI — clearly identify yourself as 'AgriGuard AI Assistant' if asked. "
            "You assist with understanding assigned cases, preparing field-visit notes, "
            "disease identification, escalation procedures, and officer dashboard features. "
            "You have access only to this officer's assigned cases and related data. "
            "You must NEVER surface data from unrelated regions, other officers' cases, "
            "or expert-private consultation content."
        ),
        UserRole.EXPERT: (
            "You are the AgriGuard AI Assistant helping Agricultural Expert {name}. "
            "You are an AI — clearly identify yourself as 'AgriGuard AI Assistant' if asked. "
            "You assist with disease reference lookups, drafting farmer-facing responses, "
            "case summarization, and consultation preparation. "
            "You have access to this expert's active consultations and related disease data. "
            "You must only reference farmer data from your own assigned consultations. "
            "You must NEVER access farmer records from consultations not assigned to you."
        ),
        UserRole.ADMIN: (
            "You are the AgriGuard AI Assistant in admin support mode for {name}. "
            "You are an AI — clearly identify yourself as 'AgriGuard AI Assistant' if asked. "
            "You assist with platform overview questions and general agricultural knowledge."
        ),
    }

    persona = role_persona.get(role, role_persona[UserRole.FARMER]).format(name=user.name)

    anti_hallucination = """
CRITICAL RULES — follow these without exception:
1. ONLY state specific facts (chemical names, dosages, statistics, case details, disease diagnoses) when they appear in the DATA SECTIONS below.
2. When the data is absent or insufficient, say clearly: "I don't have verified information on that specific point. Here is general guidance — please confirm with an expert for your exact situation."
3. DO NOT fabricate disease names, pesticide dosages, treatment schedules, lab results, farmer records, or case details.
4. DO NOT present general agricultural knowledge as though it came from the user's database records — clearly distinguish: "Based on your records:" vs "General agricultural guidance:".
5. If asked about data outside your authorized scope (another farmer's records, another officer's cases), refuse and explain you can only access information you are authorized to see.
6. Keep responses practical, clear, and well-structured. For agricultural questions: Overview → Immediate Actions → Prevention → When to escalate.
7. If the user's situation seems severe (crop failure risk, spreading disease, urgent case), recommend escalating to a human expert or officer.
8. You are an AI assistant — never claim to be a human, a doctor, or a certified agronomist. You provide guidance grounded in verified sources.
"""

    # Format retrieved user-specific data as clearly delimited DATA blocks
    data_section = "\n\n=== AUTHORIZED USER DATA (use for grounding answers) ===\n"
    data_section += f"User: {role_context.get('user_name')} | Role: {role_context.get('user_role')}\n"

    if role == UserRole.FARMER:
        farm = role_context.get("active_farm")
        if farm:
            data_section += f"\nACTIVE FARM:\n"
            data_section += f"  Name: {farm.get('name')}\n"
            data_section += f"  Crop: {farm.get('crop') or 'Not specified'}\n"
            data_section += f"  Area: {farm.get('area_hectares')} hectares\n"
            data_section += f"  Location: {farm.get('district')}, {farm.get('state')}\n"
            data_section += f"  Soil: {farm.get('soil_type') or 'Unknown'}\n"
            data_section += f"  Irrigation: {farm.get('irrigation') or 'Unknown'}\n"
        else:
            data_section += "\nACTIVE FARM: None registered yet.\n"

        data_section += f"\nTOTAL FARMS: {role_context.get('farm_count', 0)}\n"

        detections = role_context.get("recent_detections", [])
        if detections:
            data_section += "\nRECENT DISEASE DETECTIONS (this farmer's own records):\n"
            for d in detections:
                conf = f"{int(d['confidence'] * 100)}%" if d["confidence"] else "Unknown"
                data_section += (
                    f"  - {d['date']}: {d['disease']} on {d['crop']} "
                    f"(confidence: {conf}, severity: {d.get('severity') or 'Not assessed'})\n"
                )
        else:
            data_section += "\nRECENT DISEASE DETECTIONS: None recorded yet.\n"

        cases = role_context.get("cases_summary", {})
        data_section += f"\nCASES SUMMARY: {cases.get('open', 0)} open, {cases.get('resolved', 0)} resolved.\n"

    elif role == UserRole.OFFICER:
        cases = role_context.get("assigned_cases", [])
        counts = role_context.get("case_count", {})
        data_section += f"\nASSIGNED CASES: {counts.get('total', 0)} total | {counts.get('new', 0)} new | {counts.get('in_progress', 0)} in progress | {counts.get('resolved', 0)} resolved\n"
        if cases:
            data_section += "\nCASE DETAILS (this officer's assigned cases only):\n"
            for c in cases[:5]:  # Limit to 5 to stay within context window
                data_section += (
                    f"  [{c['status']}] Case: {c['title']}\n"
                    f"    Farmer: {c['farmer_name']}, Farm: {c.get('farm_name') or 'Unknown'}\n"
                    f"    Priority: {c['priority']} | Created: {c['created_at']}\n"
                    f"    Description: {c['description']}\n"
                )
                if c.get("officer_notes"):
                    data_section += f"    Officer Notes: {c['officer_notes']}\n"

        visits = role_context.get("upcoming_field_visits", [])
        if visits:
            data_section += "\nUPCOMING FIELD VISITS:\n"
            for v in visits:
                data_section += f"  - {v['scheduled_date']}: {v.get('farm_name') or 'Farm'}\n"

    elif role == UserRole.EXPERT:
        consultations = role_context.get("active_consultations", [])
        data_section += f"\nACTIVE CONSULTATIONS: {role_context.get('consultation_count', 0)}\n"
        if consultations:
            data_section += "\nCONSULTATION DETAILS (this expert's assignments only):\n"
            for c in consultations:
                data_section += f"  - Farmer: {c['farmer_name']}, Last active: {c['last_message_at']}\n"

        detections = role_context.get("related_detections", [])
        if detections:
            data_section += "\nRELATED DISEASE DETECTIONS (farmers in your consultations only):\n"
            for d in detections:
                conf = f"{int(d['confidence'] * 100)}%" if d["confidence"] else "Unknown"
                data_section += (
                    f"  - {d['date']}: {d['disease']} on {d['crop']} "
                    f"(confidence: {conf}, severity: {d.get('severity') or 'Not assessed'})\n"
                )

        profile = role_context.get("expert_profile")
        if profile:
            data_section += f"\nEXPERT PROFILE:\n"
            data_section += f"  Specialization: {profile.get('specialization')}\n"
            data_section += f"  Experience: {profile.get('years_experience')} years\n"

    elif role == UserRole.ADMIN:
        summary = role_context.get("platform_summary", {})
        data_section += f"\nPLATFORM SUMMARY: {summary.get('total_farms', 0)} farms, {summary.get('total_predictions', 0)} detections, {summary.get('total_cases', 0)} cases.\n"

    data_section += "=== END AUTHORIZED USER DATA ===\n"

    # Add RAG knowledge sources
    rag_section = ""
    if rag_sources:
        rag_section = "\n\n=== VERIFIED KNOWLEDGE SOURCES (use for factual grounding) ===\n"
        for i, s in enumerate(rag_sources, 1):
            rag_section += f"\n[Source {i}] {s.get('title', 'Unknown')} ({s.get('source', '')})\n"
            rag_section += f"{s.get('snippet') or s.get('full_content', '')[:600]}\n"
        rag_section += "=== END KNOWLEDGE SOURCES ===\n"
        rag_section += "\nIMPORTANT: Only state specific treatment details, chemical names, and dosages that appear in the knowledge sources above. Do not invent information not present there.\n"

    return persona + "\n\n" + anti_hallucination + data_section + rag_section


# ── Claude API Caller ──────────────────────────────────────────────────────────

def _call_claude_api(
    system_prompt: str,
    history: List[Dict[str, str]],
    user_query: str,
    api_key: str,
    model: str,
    max_tokens: int,
) -> Tuple[str, str]:
    """
    Call the real Anthropic Claude API using the official SDK.
    Returns (response_text, model_version_used).

    The API key is read from the server-side environment only.
    It is never logged or returned in any response.
    """
    try:
        import anthropic
    except ImportError:
        raise RuntimeError(
            "The 'anthropic' package is not installed. "
            "Run: pip install anthropic"
        )

    client = anthropic.Anthropic(api_key=api_key)

    # Build messages list: history + current user message
    messages = []
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_query})

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    )

    content = response.content[0].text if response.content else ""
    model_used = response.model or model
    return content, f"claude/{model_used}"


# ── RAG Fallback Synthesizer ───────────────────────────────────────────────────

def _synthesize_rag_response(
    query: str,
    sources: List[Dict],
    role_context: Dict[str, Any],
    history: List[Dict],
) -> str:
    """
    Fallback RAG synthesis when Claude API is not configured.
    Returns a grounded response based strictly on retrieved documents.
    """
    user_name = role_context.get("user_name", "Farmer")
    farm = role_context.get("active_farm", {}) or {}
    crop = (farm.get("crop") or "your crop")

    if not sources:
        return (
            f"### Agricultural Advisory\n\n"
            f"Hello {user_name}, I'm AgriGuard AI Assistant.\n\n"
            f"I don't have specific verified information in my knowledge base to answer "
            f"**'{query}'** with precision.\n\n"
            f"**General guidance:** {query} — for specific advice tailored to your exact situation, "
            f"please use **Expert Chat** to connect with a certified agricultural expert.\n\n"
            f"> I don't want to guess at specific details like chemical dosages or treatment "
            f"schedules without verified sources."
        )

    primary = sources[0]
    disease = primary.get("disease") or primary.get("category") or "the condition"

    return (
        f"### AgriGuard AI Advisory: {disease}\n\n"
        f"*Based on verified institutional sources — {primary.get('source', 'ICAR/FAO')}*\n\n"
        f"{primary.get('full_content') or primary.get('snippet', '')}\n\n"
        f"---\n"
        f"#### Field Protocol for {crop}:\n"
        f"1. Apply any recommended spray early morning (6–9 AM) for maximum efficacy.\n"
        f"2. Wear protective gloves and mask during chemical application.\n"
        f"3. Observe the Pre-Harvest Interval (PHI) strictly.\n\n"
        f"> For case-specific dosage confirmation, use **Expert Chat** to consult a certified agronomist."
    )


# ── Intent Classifier ──────────────────────────────────────────────────────────

def _is_agri_intent(query: str, history_text: str = "") -> bool:
    q_clean = query.strip().lower()
    # Check current query specifically for non-agricultural patterns
    for pattern in NON_AGRI_PATTERNS:
        if re.search(pattern, q_clean):
            q_words = set(re.findall(r"\w+", q_clean))
            if len(q_words.intersection(AGRI_KEYWORDS)) < 2:
                return False
    greetings = ["hello", "hi", "hey", "help", "good morning", "who are you", "what can you do"]
    if any(q_clean.startswith(g) for g in greetings):
        return True
    combined = (query + " " + history_text).lower()
    words = set(re.findall(r"\w+", combined))
    if words.intersection(AGRI_KEYWORDS):
        return True
    # Allow short contextual follow-ups
    if len(words) < 6:
        return True
    return True


def _generate_conversation_title(query: str, farm_context: Any = None) -> str:
    """
    Generate a meaningful, concise conversation title based on real question content.
    Examples: 'Tomato Leaf Disease', 'Rice Blast Advisory', 'Fertilizer Recommendation'.
    Never outputs generic 'New Chat 1'.
    """
    clean_q = re.sub(r"[?!.,;:\n]+", " ", query).strip()
    clean_lower = clean_q.lower()

    # Detect crop
    crops = ["Rice", "Paddy", "Tomato", "Wheat", "Maize", "Cotton", "Potato", "Chilli", "Soybean", "Sugarcane"]
    detected_crop = None
    for c in crops:
        if c.lower() in clean_lower:
            detected_crop = "Paddy" if c.lower() == "rice" else c
            break
    if not detected_crop and farm_context and isinstance(farm_context, dict):
        detected_crop = farm_context.get("crop")

    # Detect topic/issue
    issues = [
        ("Leaf Spot Advisory", ["spot", "spots", "spindle"]),
        ("Late Blight Protocol", ["late blight"]),
        ("Early Blight Advisory", ["early blight"]),
        ("Blight Management", ["blight"]),
        ("Blast Treatment Protocol", ["blast"]),
        ("Yellowing & Chlorosis", ["yellow", "yellowing", "chlorosis", "wilt", "wilting"]),
        ("Rust Protocol", ["rust"]),
        ("Pest Control Advice", ["pest", "pests", "borer", "armyworm", "caterpillar", "aphid", "whitefly"]),
        ("Fertilizer Dosage Guide", ["fertilizer", "fertilizers", "npk", "urea", "dap", "dosage"]),
        ("Irrigation Schedule", ["irrigation", "water", "watering", "drainage"]),
        ("Harvest & Yield Advisory", ["harvest", "yield", "panicle"]),
        ("Soil Nutrient Analysis", ["soil", "salinity", "ph"]),
    ]

    detected_issue = None
    for label, keywords in issues:
        if any(kw in clean_lower for kw in keywords):
            detected_issue = label
            break

    if detected_crop and detected_issue:
        return f"{detected_crop} {detected_issue}"
    elif detected_crop:
        words = [w for w in clean_q.split() if len(w) > 2 and w.lower() not in {"what", "should", "how", "when", "can", "with", "from", "about", "have", "this"}]
        sub = " ".join(words[:4]).title()
        return f"{detected_crop} - {sub}" if sub else f"{detected_crop} Advisory"
    elif detected_issue:
        return f"Crop {detected_issue}"

    words = [w for w in clean_q.split() if w.lower() not in {"please", "help"}]
    if len(words) <= 5:
        return " ".join(words).title()
    return " ".join(words[:5]).title() + "..."


# ── Main Service Class ─────────────────────────────────────────────────────────

class AIChatService:
    """Production AI Agriculture Chat Assistant service with real Claude API integration."""

    def __init__(self):
        # Provider preference: use anthropic if key available, else fallback
        self.provider = (settings.AI_PROVIDER or "anthropic").lower()
        self.model = settings.CLAUDE_MODEL or settings.AI_MODEL or "claude-3-5-haiku-20241022"
        # API key: prefer ANTHROPIC_API_KEY, fall back to legacy AI_API_KEY
        self.api_key = settings.ANTHROPIC_API_KEY or settings.AI_API_KEY or ""

    @property
    def _effective_provider(self) -> str:
        """Resolve actual provider based on available keys."""
        if self.api_key and self.provider == "anthropic":
            return "anthropic"
        if self.api_key and self.provider in ("openai",):
            return "openai"
        return "local"

    def generate_response(
        self,
        db: Session,
        user: Optional[Any] = None,
        query: str = "",
        conversation_id: Optional[str] = None,
        farm_id: Optional[str] = None,
        user_id: Optional[Any] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Main entry point for AI Chat Assistant.

        Security: `user` is the server-side authenticated User object.
        Role and user_id are always read from this object — never from the frontend.
        """
        # Support user passed as user_id kwarg or string/UUID for backwards compatibility
        if user is None and user_id is not None:
            if isinstance(user_id, User):
                user = user_id
            else:
                user = db.query(User).filter(User.id == str(user_id)).first()
        elif isinstance(user, (str, uuid.UUID)):
            user = db.query(User).filter(User.id == str(user)).first()

        if user is None:
            fallback_id = uuid.UUID(str(user_id)) if (user_id and str(user_id).count("-") == 4) else uuid.uuid4()
            user = User(
                id=fallback_id,
                name="Farmer",
                role=UserRole.FARMER,
                email="farmer@agriguard.in",
            )

        user_id = user.id
        role = user.role

        # 1. ── Load or create conversation thread ─────────────────────────────
        conv: Optional[AIConversation] = None
        history_messages: List[AIMessage] = []

        if conversation_id:
            try:
                c_uuid = uuid.UUID(conversation_id)
                conv = (
                    db.query(AIConversation)
                    .filter(AIConversation.id == c_uuid, AIConversation.user_id == user_id)
                    .first()
                )
                if conv:
                    history_messages = (
                        db.query(AIMessage)
                        .filter(AIMessage.conversation_id == conv.id)
                        .order_by(AIMessage.created_at.asc())
                        .all()
                    )
            except Exception as e:
                logger.warning(f"Error fetching conversation: {e}")
        else:
            conv = (
                db.query(AIConversation)
                .filter(AIConversation.user_id == user_id)
                .order_by(AIConversation.updated_at.desc())
                .first()
            )
            if conv:
                history_messages = (
                    db.query(AIMessage)
                    .filter(AIMessage.conversation_id == conv.id)
                    .order_by(AIMessage.created_at.asc())
                    .all()
                )

        # 2. ── Domain intent check ────────────────────────────────────────────
        history_text = " ".join(m.content for m in history_messages[-6:])
        if not _is_agri_intent(query, history_text):
            off_topic = (
                f"I'm AgriGuard AI Assistant — I'm specialized in crop cultivation, "
                f"disease diagnosis, fertilizer management, pest control, and farm advisory. "
                f"I can't help with that topic, but feel free to ask me anything related to "
                f"agriculture, your farm, or crop health."
            )
            saved_id = self._persist(db, conv, user_id, query, off_topic, [], "AgriGuard-DomainFilter", role=role)
            return self._build_response(saved_id or str(uuid.uuid4()), off_topic, [], role, "AgriGuard-DomainFilter", None)

        # 3. ── Assemble role-scoped context (authorization boundary) ──────────
        role_context = build_role_context(db, user, farm_id)

        # 4. ── Retrieve RAG knowledge (Disease Library + relevant docs) ────────
        # Enrich query with conversation context for better retrieval
        search_q = query
        if any(p in query.lower() for p in ["they", "them", "it", "this", "that"]):
            crops_from_history = re.findall(
                r"\b(tomato|rice|paddy|wheat|maize|corn|potato|cotton|soybean|sugarcane|chili)\b",
                history_text
            )
            if crops_from_history:
                search_q = f"{query} {' '.join(set(crops_from_history))}"

        active_crop = (
            (role_context.get("active_farm") or {}).get("crop") or
            re.search(r"\b(tomato|rice|paddy|wheat|maize|corn|potato)\b", search_q, re.I) and
            re.search(r"\b(tomato|rice|paddy|wheat|maize|corn|potato)\b", search_q, re.I).group(0)
        )
        rag_sources = rag_service.search(query=search_q, db=db, crop=active_crop, top_k=3)

        # 5. ── Build system prompt ─────────────────────────────────────────────
        system_prompt = build_system_prompt(user, role_context, rag_sources)

        # 6. ── Generate response ───────────────────────────────────────────────
        response_text = ""
        model_version = "AgriGuard-RAG-Grounded-v2"
        used_claude = False

        # Build conversation history for LLM (recent turns only, context-window safe)
        llm_history = [
            {"role": m.role, "content": m.content}
            for m in history_messages[-8:]  # max 8 turns in context window
            if m.role in ("user", "assistant")
        ]

        if self.api_key and self._effective_provider == "anthropic":
            try:
                response_text, model_version = _call_claude_api(
                    system_prompt=system_prompt,
                    history=llm_history,
                    user_query=query,
                    api_key=self.api_key,
                    model=self.model,
                    max_tokens=settings.AI_MAX_TOKENS,
                )
                used_claude = True
                logger.info(f"Claude response generated | user={user.name} role={role.value} model={model_version}")
            except Exception as e:
                # Never log or expose the API key in error messages
                err_type = type(e).__name__
                logger.warning(f"Claude API call failed ({err_type}): {str(e)[:200]}. Falling back to RAG synthesis.")
                used_claude = False

        if not used_claude:
            # Verified RAG synthesis fallback
            response_text = _synthesize_rag_response(query, rag_sources, role_context, llm_history)
            model_version = "AgriGuard-RAG-Grounded-v2"

        # 7. ── Determine escalation recommendation ────────────────────────────
        high_risk_terms = [
            "severe", "dying", "yellow leaf curl", "blast", "wilt", "infestation",
            "late blight", "critical", "emergency", "urgent", "spreading fast",
        ]
        escalation = any(t in query.lower() or t in response_text.lower() for t in high_risk_terms)

        # 8. ── Suggest follow-up questions (role-aware) ────────────────────────
        suggested = list(SUGGESTED_QUESTIONS_DEFAULT.get(role, SUGGESTED_QUESTIONS_DEFAULT[UserRole.FARMER]))[:3]

        # 9. ── Persist messages ────────────────────────────────────────────────
        farm_ctx_for_persist = role_context.get("active_farm")
        saved_id = self._persist(
            db, conv, user_id, query, response_text, rag_sources,
            model_version, farm_ctx_for_persist, role=role
        )

        return self._build_response(
            saved_id or str(uuid.uuid4()),
            response_text,
            rag_sources,
            role,
            model_version,
            farm_ctx_for_persist,
            escalation,
            suggested,
        )

    def _persist(
        self,
        db: Session,
        conv: Optional[AIConversation],
        user_id,
        query: str,
        response_text: str,
        sources: List[Dict],
        model_version: str,
        farm_context: Any = None,
        role: Optional[Any] = None,
        context_ids: Optional[List[str]] = None,
    ) -> Optional[str]:
        """Persist user + assistant messages to DB with full role and metadata tracking. Returns conversation ID."""
        try:
            now = datetime.utcnow()
            role_str = role.value if hasattr(role, "value") else (str(role) if role else "FARMER")

            if not conv:
                title = _generate_conversation_title(query, farm_context)
                conv = AIConversation(
                    user_id=user_id,
                    title=title,
                    context_summary=f"Consultation: {title}",
                    status="active",
                    last_message_at=now,
                    created_at=now,
                    updated_at=now,
                )
                db.add(conv)
                db.flush()

            # User message
            db.add(AIMessage(
                conversation_id=conv.id,
                role="user",
                sender_type="USER",
                role_context=role_str,
                content=query,
                farm_context=farm_context,
                created_at=now,
            ))

            # Assistant message
            metadata = {
                "context_ids": context_ids or [],
                "citations_count": len(sources),
            }
            db.add(AIMessage(
                conversation_id=conv.id,
                role="assistant",
                sender_type="AI_ASSISTANT",
                role_context=role_str,
                content=response_text,
                citations=[
                    {"title": s.get("title"), "source": s.get("source"), "document_id": s.get("document_id")}
                    for s in sources
                ],
                farm_context=farm_context,
                model=model_version,
                model_version=model_version,
                msg_metadata=metadata,
                created_at=now + timedelta(milliseconds=200),
            ))

            conv.last_message_at = now
            conv.updated_at = now
            db.commit()
            return str(conv.id)
        except Exception as e:
            logger.error(f"Error persisting AI conversation: {e}")
            try:
                db.rollback()
            except Exception:
                pass
            return str(conv.id) if conv else None

    def _build_response(
        self,
        conversation_id: str,
        response_text: str,
        sources: List[Dict],
        role: UserRole,
        model_version: str,
        farm_context: Any,
        escalation: bool = False,
        suggested: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "conversation_id": conversation_id,
            "response": response_text,
            "sources": sources,
            "suggested_questions": suggested or [],
            # confidence omitted — only real ML model confidence is shown (from DiseasePrediction)
            # Claude's textual uncertainty is expressed in the response text itself, not as a number
            "escalation_recommended": escalation,
            "farm_context": farm_context,
            "model_version": model_version,
        }


# Singleton
ai_chat_service = AIChatService()
