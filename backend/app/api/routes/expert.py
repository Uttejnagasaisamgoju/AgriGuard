from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.chat import Conversation, Message, ExpertProfile
from app.models.officer import OfficerCase, CaseStatus
from app.models.disease import DiseasePrediction
from app.auth.dependencies import get_current_user, require_role
from pydantic import BaseModel

router = APIRouter(prefix="/api/expert", tags=["Expert"])


class AvailabilityUpdate(BaseModel):
    is_online: bool


@router.get("/dashboard")
async def get_expert_dashboard(
    current_user: User = Depends(require_role(UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Real Expert Dashboard metrics and incoming consultations from database"""
    profile = db.query(ExpertProfile).filter(ExpertProfile.user_id == current_user.id).first()

    # 1. Active Conversations
    conv_query = db.query(Conversation).filter(Conversation.expert_id == current_user.id)
    total_convs = conv_query.count()

    # 2. Pending Questions (unread messages sent to this expert)
    pending_questions = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read == False,
    ).count()

    # 3. Farmers Helped (distinct farmers in conversations with messages)
    distinct_farmers = db.query(func.count(func.distinct(Conversation.farmer_id))).filter(
        Conversation.expert_id == current_user.id
    ).scalar() or 0

    # 4. Rating
    rating_val = profile.rating if profile and profile.rating else "4.9"

    # 5. Incoming Consultations (real cases flagged or conversations initiated)
    conversations = conv_query.order_by(Conversation.last_message_at.desc()).limit(10).all()
    
    consultations_list = []
    for c in conversations:
        farmer = db.query(User).filter(User.id == c.farmer_id).first()
        last_msg = c.messages[-1] if c.messages else None
        
        # Check if farmer has a recent disease prediction
        recent_pred = db.query(DiseasePrediction).filter(
            DiseasePrediction.user_id == c.farmer_id
        ).order_by(DiseasePrediction.created_at.desc()).first()

        crop_topic = recent_pred.primary_crop if recent_pred else "Crop Health"
        disease_topic = recent_pred.primary_disease if recent_pred else (last_msg.content[:30] if last_msg and last_msg.content else "General Consultation")
        
        time_diff = datetime.utcnow() - c.last_message_at
        if time_diff.total_seconds() < 3600:
            time_str = f"{max(1, int(time_diff.total_seconds() / 60))}m ago"
        elif time_diff.total_seconds() < 86400:
            time_str = f"{int(time_diff.total_seconds() / 3600)}h ago"
        else:
            time_str = f"{int(time_diff.days)}d ago"

        consultations_list.append({
            "id": str(c.id),
            "farmer_id": str(c.farmer_id),
            "farmer_name": farmer.name if farmer else "Farmer",
            "crop": crop_topic,
            "topic": disease_topic,
            "priority": "High" if (recent_pred and (recent_pred.overall_confidence or 0) >= 0.8) else "Medium",
            "time": time_str,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "unread": db.query(Message).filter(Message.conversation_id == c.id, Message.receiver_id == current_user.id, Message.is_read == False).count() > 0,
        })

    # Also check if there are recent OfficerCases that need expert review
    recent_cases = db.query(OfficerCase).order_by(OfficerCase.created_at.desc()).limit(5).all()
    for rc in recent_cases:
        farmer = db.query(User).filter(User.id == rc.farmer_id).first()
        already_in = any(item["farmer_id"] == str(rc.farmer_id) for item in consultations_list)
        if not already_in and farmer:
            time_diff = datetime.utcnow() - rc.created_at
            time_str = f"{max(1, int(time_diff.total_seconds() / 60))}m ago" if time_diff.total_seconds() < 3600 else f"{int(time_diff.total_seconds() / 3600)}h ago"
            consultations_list.append({
                "id": str(rc.id),
                "farmer_id": str(rc.farmer_id),
                "farmer_name": farmer.name,
                "crop": rc.farm.crop_type if rc.farm and rc.farm.crop_type else "Crops",
                "topic": rc.title.replace("Disease Detected: ", "").replace("Disease Detection: ", ""),
                "priority": rc.priority.capitalize() if rc.priority else "Medium",
                "time": time_str,
                "created_at": rc.created_at.isoformat() if rc.created_at else None,
                "unread": rc.status == CaseStatus.NEW,
            })

    return {
        "expert": {
            "name": current_user.name,
            "email": current_user.email,
            "specialization": profile.specialization if profile else "Plant Pathology",
            "is_online": profile.is_online if profile else True,
            "is_verified": profile.is_verified if profile else True,
            "rating": rating_val,
        },
        "stats": {
            "active_conversations": total_convs,
            "pending_questions": pending_questions,
            "farmers_helped": distinct_farmers,
            "avg_rating": rating_val,
        },
        "incoming_consultations": consultations_list,
    }


@router.put("/availability")
async def update_availability(
    req: AvailabilityUpdate,
    current_user: User = Depends(require_role(UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = db.query(ExpertProfile).filter(ExpertProfile.user_id == current_user.id).first()
    if not profile:
        profile = ExpertProfile(user_id=current_user.id, is_online=req.is_online)
        db.add(profile)
    else:
        profile.is_online = req.is_online
    db.commit()
    return {"message": "Availability updated", "is_online": profile.is_online}


@router.get("/consultations")
async def get_consultations(
    current_user: User = Depends(require_role(UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    convs = db.query(Conversation).filter(Conversation.expert_id == current_user.id).order_by(Conversation.last_message_at.desc()).all()
    res = []
    for c in convs:
        farmer = db.query(User).filter(User.id == c.farmer_id).first()
        last_msg = c.messages[-1] if c.messages else None
        res.append({
            "conversation_id": str(c.id),
            "farmer": {
                "id": str(farmer.id) if farmer else None,
                "name": farmer.name if farmer else "Farmer",
                "email": farmer.email if farmer else None,
                "phone": farmer.phone if farmer else None,
            },
            "last_message": last_msg.content if last_msg else None,
            "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
            "unread_count": db.query(Message).filter(Message.conversation_id == c.id, Message.receiver_id == current_user.id, Message.is_read == False).count(),
        })
    return {"consultations": res, "total": len(res)}


@router.get("/cases")
async def get_expert_cases(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    query = db.query(OfficerCase)
    if status:
        if status.upper() == "RESOLVED":
            query = query.filter(OfficerCase.status == CaseStatus.RESOLVED)
        elif status.lower() == "active":
            query = query.filter(OfficerCase.status != CaseStatus.RESOLVED)
        else:
            try:
                query = query.filter(OfficerCase.status == CaseStatus(status))
            except ValueError:
                pass

    total = query.count()
    cases = query.order_by(OfficerCase.updated_at.desc()).offset(skip).limit(limit).all()
    from app.api.routes.officer import _case_to_dict
    return {"cases": [_case_to_dict(c) for c in cases], "total": total}

