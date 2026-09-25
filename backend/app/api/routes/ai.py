"""
AgriGuard AI Assistant and Model Management API Routes.
Provides endpoints for AI agricultural chat, conversation history, RAG sources,
model status and metrics, expert feedback loop, and automated evaluation.
"""
import logging
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.chat import AIConversation, AIMessage
from app.models.disease import ExpertFeedback, ModelVersion, KnowledgeDocument
from app.services.ai_chat_service import ai_chat_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


# ------------------ Pydantic Schemas ------------------

class AIChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Farmer query on crops, disease, soil, etc.")
    conversation_id: Optional[str] = Field(None, description="Active conversation thread ID")
    farm_id: Optional[str] = Field(None, description="Contextual farm ID")
    language: Optional[str] = Field("en", description="Target language code (e.g. te, ta, kn, ml, mr, en)")


class CitationItem(BaseModel):
    document_id: str
    title: str
    source: str
    crop: Optional[str] = None
    disease: Optional[str] = None
    category: Optional[str] = None
    relevance_score: float
    snippet: str
    last_verified: Optional[str] = None


class AIChatResponse(BaseModel):
    conversation_id: str
    response: str
    sources: List[CitationItem]
    suggested_questions: List[str]
    # confidence intentionally omitted — real ML model confidence is separate from AI text uncertainty.
    # The assistant expresses uncertainty in its text, not as a fabricated numeric score.
    escalation_recommended: bool
    farm_context: Optional[Dict[str, Any]] = None
    model_version: str


class ExpertFeedbackRequest(BaseModel):
    prediction_id: Optional[str] = None
    image_path: Optional[str] = None
    original_prediction: str
    original_confidence: float
    original_model_version: Optional[str] = "disease-model-v1.0.0"
    expert_label: str
    reviewer_role: Optional[str] = "EXPERT"
    reviewer_decision: Optional[str] = "CONFIRMED"  # CONFIRMED, CORRECTED, HEALTHY, INVALID, UNCERTAIN
    corrected_severity: Optional[str] = None
    corrected_stage: Optional[str] = None
    crop: Optional[str] = None
    disease: Optional[str] = None
    notes: Optional[str] = None
    consent_given: Optional[bool] = True
    dataset_version: Optional[str] = "Dataset-v2"



# ------------------ Routes ------------------

@router.post("/chat")
def chat_with_ai(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Interact with AgriGuard AI Agriculture Chat Assistant.

    Security: user identity and role are always read from the server-side
    authenticated current_user object. The frontend cannot override them.
    Role-scoped context is assembled server-side before any data reaches Claude.
    """
    try:
        from app.services.ai_provider_service import ai_service
        result = ai_service.generate_response(
            db=db,
            user=current_user,          # ← full User object with real role from DB
            query=req.query,
            conversation_id=req.conversation_id,
            farm_id=req.farm_id,
            language=req.language or getattr(current_user, "language", "en") or "en",
        )
        return result
    except Exception as e:
        logger.error(f"Error processing AI chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The AI Assistant is temporarily unavailable. Please try again in a moment."
        )


@router.post("/chat/stream")
async def stream_chat_with_ai(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streaming SSE endpoint for progressive text delivery from AgriGuard AI Assistant.
    """
    from fastapi.responses import StreamingResponse
    from app.services.ai_provider_service import ai_service

    try:
        return StreamingResponse(
            ai_service.stream_response(
                db=db,
                user=current_user,
                query=req.query,
                conversation_id=req.conversation_id,
                farm_id=req.farm_id,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.error(f"Error streaming AI chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Streaming AI Assistant is temporarily unavailable."
        )


@router.get("/conversations")
def get_user_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all AI conversations for current user"""
    convs = (
        db.query(AIConversation)
        .filter(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.updated_at.desc())
        .all()
    )
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "context_summary": c.context_summary,
            "status": getattr(c, "status", "active") or "active",
            "last_message_at": c.last_message_at.isoformat() if getattr(c, "last_message_at", None) else (c.updated_at.isoformat() if c.updated_at else None),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "message_count": len(c.messages),
        }
        for c in convs
    ]


@router.get("/conversations/active")
def get_active_ai_conversation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the most recent active AI conversation and its messages for the authenticated user.
    Used for instant, permanent restoration of AI chat history on refresh.
    """
    conv = (
        db.query(AIConversation)
        .filter(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.updated_at.desc())
        .first()
    )
    if not conv:
        return {"conversation": None}

    return {
        "conversation": {
            "id": str(conv.id),
            "title": conv.title,
            "context_summary": conv.context_summary,
            "status": getattr(conv, "status", "active") or "active",
            "last_message_at": conv.last_message_at.isoformat() if getattr(conv, "last_message_at", None) else (conv.updated_at.isoformat() if conv.updated_at else None),
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "messages": [
                {
                    "id": str(m.id),
                    "role": m.role,
                    "sender_type": getattr(m, "sender_type", "AI_ASSISTANT" if m.role == "assistant" else "USER"),
                    "role_context": getattr(m, "role_context", "FARMER"),
                    "content": m.content,
                    "citations": m.citations or [],
                    "farm_context": m.farm_context,
                    "model": getattr(m, "model", m.model_version),
                    "model_version": m.model_version,
                    "metadata": getattr(m, "msg_metadata", None),
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in conv.messages
            ],
        }
    }


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get message history for a specific AI conversation with pagination"""
    try:
        c_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")

    conv = (
        db.query(AIConversation)
        .filter(AIConversation.id == c_uuid, AIConversation.user_id == current_user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == c_uuid)
        .order_by(AIMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "sender_type": getattr(m, "sender_type", "AI_ASSISTANT" if m.role == "assistant" else "USER"),
            "role_context": getattr(m, "role_context", "FARMER"),
            "content": m.content,
            "citations": m.citations or [],
            "farm_context": m.farm_context,
            "model": getattr(m, "model", m.model_version),
            "model_version": m.model_version,
            "metadata": getattr(m, "msg_metadata", None),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an AI conversation thread and all its messages.
    Strictly authorized to the authenticated conversation owner.
    """
    try:
        c_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")

    conv = (
        db.query(AIConversation)
        .filter(AIConversation.id == c_uuid, AIConversation.user_id == current_user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or unauthorized")

    # Delete all messages in the thread and remove conversation
    db.query(AIMessage).filter(AIMessage.conversation_id == c_uuid).delete()
    db.delete(conv)
    db.commit()

    return {"status": "success", "message": "Conversation cleared successfully", "deleted_id": conversation_id}


@router.post("/conversations")
def create_new_conversation(
    title: Optional[str] = Query(None, description="Optional title for new conversation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initialize a clean AI conversation thread for the current authenticated user"""
    now = datetime.utcnow()
    conv = AIConversation(
        user_id=current_user.id,
        title=title or "New Farming Consultation",
        context_summary="Fresh conversation",
        status="active",
        last_message_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "status": conv.status,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


@router.get("/sources")
def get_knowledge_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all agricultural extension knowledge base documents used by RAG"""
    return rag_service.get_all_documents(db)


@router.get("/evaluation")
def get_ai_evaluation_report(
    current_user: User = Depends(get_current_user),
):
    """
    Returns verified results from the 50-Question Agronomy AI Evaluation Suite.
    Includes per-category accuracy, latency, and overall benchmark score.
    """
    report_file = Path("tests/ai_evaluation_report.json")
    if not report_file.exists():
        # Check relative to backend
        report_file = Path(__file__).resolve().parent.parent.parent / "tests" / "ai_evaluation_report.json"

    if report_file.exists():
        try:
            with open(report_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error reading evaluation report: {e}")

    return {
        "status": "pending",
        "message": "Evaluation report not yet generated. Run test_ai_evaluation.py to produce benchmarks.",
    }


@router.get("/models/status")
def get_models_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get live status, accuracy metrics, and architectures for all AI and ML models.
    Shows real measured metrics (zero fake numbers).
    """
    from app.services.ml_service import MLService
    from app.ml.leaf_validator import leaf_validator

    metrics_file = Path("uploads/models/disease_model_metrics.json")
    disease_metrics = None
    if metrics_file.exists():
        try:
            with open(metrics_file, "r") as f:
                disease_metrics = json.load(f)
        except Exception as e:
            logger.warning(f"Could not read disease_model_metrics.json: {e}")

    # Fallback to model_versions table if JSON not directly on disk
    if not disease_metrics:
        latest_version = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).first()
        if latest_version:
            disease_metrics = {
                "model_version": latest_version.version,
                "architecture": latest_version.architecture,
                "accuracy": latest_version.accuracy,
                "precision": latest_version.precision,
                "recall": latest_version.recall,
                "f1_score": latest_version.f1_score,
                "num_classes": latest_version.num_classes,
                "status": latest_version.status,
                "timestamp": latest_version.created_at.isoformat() if latest_version.created_at else None,
            }

    doc_count = db.query(KnowledgeDocument).count()
    feedback_count = db.query(ExpertFeedback).count()

    return {
        "disease_detection_model": {
            "status": "active" if disease_metrics else "ready_for_training",
            "metrics": disease_metrics,
            "model_path": "uploads/models/best_model.pt",
            "classes_count": disease_metrics.get("num_classes", 12) if disease_metrics else 12,
        },
        "leaf_validator": {
            "status": "active" if leaf_validator.model is not None else "rules_active",
            "type": "MultiStage (FFT Screen + Laplacian Blur + HSV Pigment + RandomForest 24-Feature)",
            "classes": ["valid_leaf", "invalid_non_leaf"],
            "model_path": "uploads/models/leaf_validator.joblib",
        },
        "rag_knowledge_base": {
            "status": "active",
            "indexed_documents": doc_count,
            "vector_engine": "TF-IDF N-gram (1,2) + Cosine Similarity",
        },
        "ai_assistant": {
            "provider": ai_chat_service.provider,
            "model": ai_chat_service.model,
            "has_api_key": bool(ai_chat_service.api_key),
            "fallback_engine": "Verified Agronomy RAG Synthesis Engine",
        },
        "expert_feedback_loop": {
            "total_feedback_records": feedback_count,
            "status": "collecting_for_v2",
        },
    }


@router.post("/expert-feedback")
def submit_expert_feedback(
    req: ExpertFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit labeled plant pathology correction for an image or diagnosis.
    Stores expert annotations into expert_feedback table for model retraining.
    """
    pred_uuid = None
    if req.prediction_id:
        try:
            pred_uuid = uuid.UUID(req.prediction_id)
        except ValueError:
            pass

    feedback = ExpertFeedback(
        prediction_id=pred_uuid,
        image_path=req.image_path,
        original_prediction=req.original_prediction,
        original_confidence=req.original_confidence,
        original_model_version=req.original_model_version,
        expert_label=req.expert_label,
        reviewer_role=req.reviewer_role or current_user.role.value,
        reviewer_decision=req.reviewer_decision or "CONFIRMED",
        corrected_severity=req.corrected_severity,
        corrected_stage=req.corrected_stage,
        expert_id=current_user.id,
        crop=req.crop,
        disease=req.disease,
        notes=req.notes,
        is_verified=True,
        consent_given=req.consent_given if req.consent_given is not None else True,
        training_state="training_eligible" if req.reviewer_decision in ["CONFIRMED", "CORRECTED"] else "quality_checked",
        dataset_version=req.dataset_version or "Dataset-v2",
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {
        "success": True,
        "feedback_id": str(feedback.id),
        "message": f"Expert feedback saved for {req.expert_label}. Decision: {feedback.reviewer_decision}. State: {feedback.training_state}.",
        "created_at": feedback.created_at.isoformat(),
    }


@router.get("/training/pipeline")
def get_training_pipeline_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Real Farmer-Submitted Image Training Pipeline & Quality Control Status.
    Enforces privacy, consent, blur/quality gates, and verified provenance.
    """
    from app.models.disease import ImageValidation, DiseasePrediction

    total_validations = db.query(ImageValidation).count()
    rejected_quality = db.query(ImageValidation).filter(ImageValidation.is_valid == False).count()
    quality_passed = total_validations - rejected_quality

    total_feedback = db.query(ExpertFeedback).count()
    verified_labels = db.query(ExpertFeedback).filter(ExpertFeedback.is_verified == True).count()
    training_eligible = db.query(ExpertFeedback).filter(
        ExpertFeedback.training_state == "training_eligible",
        ExpertFeedback.consent_given == True
    ).count()

    return {
        "pipeline_version": "AgriGuard-Pipeline-v2.0",
        "dataset_version": "Dataset-v2",
        "current_active_model": "disease-model-v1.0.0",
        "lifecycle_states": [
            "submitted", "quality_checked", "awaiting_label", "expert_confirmed",
            "officer_confirmed", "rejected", "training_eligible", "training_used"
        ],
        "statistics": {
            "total_submitted_images": total_validations,
            "quality_checked_images": quality_passed,
            "rejected_by_quality_gate": rejected_quality,
            "expert_reviewed_labels": total_feedback,
            "verified_labels": verified_labels,
            "training_eligible_samples": training_eligible,
        },
        "quality_gates": {
            "min_blur_score": 60.0,
            "screen_moiré_rejection": "Active (FFT 2D spectral peak analysis)",
            "photosynthetic_pigment_check": "Active (HSV Chlorophyll & Lesion Segmentation)",
            "consent_required": True,
        },
        "early_stage_support": {
            "supported": False,
            "status": "NOT YET SUPPORTED",
            "reason": "Insufficient stage-stratified annotations in current training dataset.",
            "data_collection_requirement": "Collecting stage-annotated field specimens for Rice, Tomato, Potato, and Maize under varying lighting conditions."
        }
    }
