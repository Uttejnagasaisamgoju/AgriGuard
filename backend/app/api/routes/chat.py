from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.database.session import get_db
from app.models.chat import Conversation, Message, ExpertProfile, MessageType
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.auth.dependencies import get_current_user
from app.services.storage_service import StorageService
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["Chat & Experts"])
storage = StorageService()


class SendMessageRequest(BaseModel):
    content: Optional[str] = None
    message_type: str = "text"
    metadata: Optional[dict] = None


@router.get("/experts")
async def list_experts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    experts = db.query(User).filter(
        User.role == UserRole.EXPERT,
        User.is_active == True,
    ).all()
    result = []
    for e in experts:
        profile = db.query(ExpertProfile).filter(ExpertProfile.user_id == e.id).first()
        result.append({
            "id": str(e.id),
            "name": e.name,
            "email": e.email,
            "profile_image": e.profile_image,
            "specialization": profile.specialization if profile else None,
            "qualifications": profile.qualifications if profile else None,
            "years_experience": profile.years_experience if profile else None,
            "crops_expertise": profile.crops_expertise if profile else [],
            "is_online": profile.is_online if profile else False,
            "rating": profile.rating if profile else None,
            "total_consultations": profile.total_consultations if profile else "0",
            "bio": profile.bio if profile else None,
        })
    return {"experts": result}


@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch all conversations where current user is a participant (farmer, officer, or expert)
    convs = db.query(Conversation).filter(
        (Conversation.farmer_id == current_user.id) | (Conversation.expert_id == current_user.id)
    ).order_by(Conversation.last_message_at.desc()).all()

    result = []
    for c in convs:
        last_msg = c.messages[-1] if c.messages else None
        other_user_id = c.expert_id if str(c.farmer_id) == str(current_user.id) else c.farmer_id
        other_user = db.query(User).filter(User.id == other_user_id).first()
        unread = db.query(Message).filter(
            Message.conversation_id == c.id,
            Message.receiver_id == current_user.id,
            Message.is_read == False,
        ).count()
        result.append({
            "id": str(c.id),
            "other_user": {"id": str(other_user.id), "name": other_user.name, "role": other_user.role.value, "profile_image": other_user.profile_image} if other_user else None,
            "last_message": {"content": last_msg.content, "created_at": last_msg.created_at.isoformat()} if last_msg else None,
            "unread_count": unread,
            "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
        })
    return {"conversations": result}


@router.get("/conversations/active")
async def get_active_conversation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the most recent active conversation with messages for seamless refresh restoration"""
    conv = db.query(Conversation).filter(
        (Conversation.farmer_id == current_user.id) | (Conversation.expert_id == current_user.id)
    ).order_by(Conversation.last_message_at.desc()).first()
    if not conv:
        return {"conversation": None}

    other_user_id = conv.expert_id if str(conv.farmer_id) == str(current_user.id) else conv.farmer_id
    other_user = db.query(User).filter(User.id == other_user_id).first()
    messages = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.created_at.asc()).limit(200).all()

    return {
        "conversation": {
            "id": str(conv.id),
            "other_user": {
                "id": str(other_user.id),
                "name": other_user.name,
                "role": other_user.role.value,
                "profile_image": other_user.profile_image
            } if other_user else None,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "messages": [_msg_to_dict(m) for m in messages],
        }
    }


@router.post("/conversations")
async def start_conversation(
    expert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expert = db.query(User).filter(User.id == expert_id).first()
    if not expert:
        raise HTTPException(status_code=404, detail="Consultant not found")

    # Check if conversation already exists between these two users
    existing = db.query(Conversation).filter(
        ((Conversation.farmer_id == current_user.id) & (Conversation.expert_id == expert_id)) |
        ((Conversation.farmer_id == expert_id) & (Conversation.expert_id == current_user.id))
    ).first()
    if existing:
        return {"conversation_id": str(existing.id), "message": "Existing conversation"}

    conv = Conversation(
        farmer_id=current_user.id,
        expert_id=expert_id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"conversation_id": str(conv.id), "message": "Conversation started"}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: str,
    skip: int = 0,
    limit: int = 200,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conv.farmer_id) != str(current_user.id) and str(conv.expert_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied: You are not an authorized participant in this consultation.")

    messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.asc()).offset(skip).limit(limit).all()

    # Mark received messages as read
    db.query(Message).filter(
        Message.conversation_id == conv_id,
        Message.receiver_id == current_user.id,
        Message.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()

    return {
        "messages": [_msg_to_dict(m) for m in messages],
        "total": len(messages),
    }


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: str,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conv.farmer_id) != str(current_user.id) and str(conv.expert_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied: You cannot send messages to a conversation you are not part of.")

    receiver_id = conv.expert_id if str(conv.farmer_id) == str(current_user.id) else conv.farmer_id

    # Deduplication prevention: check for exact duplicate text submitted within 2 seconds
    if req.content:
        recent_dup = db.query(Message).filter(
            Message.conversation_id == conv_id,
            Message.sender_id == current_user.id,
            Message.content == req.content,
        ).order_by(Message.created_at.desc()).first()
        if recent_dup and recent_dup.created_at and (datetime.utcnow() - recent_dup.created_at).total_seconds() < 2.0:
            return {"message": _msg_to_dict(recent_dup)}

    msg = Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message_type=MessageType(req.message_type),
        content=req.content,
        msg_metadata=req.metadata,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    # Create notification & push payload
    role_label = "Agronomy Expert" if current_user.role == UserRole.EXPERT else ("Agricultural Officer" if current_user.role == UserRole.OFFICER else "Farmer")
    snippet = (req.content[:90] + '...') if req.content and len(req.content) > 90 else (req.content or 'Sent an attachment')
    push_title = f"{current_user.name} ({role_label})"
    push_body = f"{snippet} — tap to open consultation"

    notif = Notification(
        user_id=receiver_id,
        type=NotificationType.EXPERT_MESSAGE if current_user.role == UserRole.EXPERT else NotificationType.OFFICER_MESSAGE,
        title=push_title,
        message=push_body,
        related_entity_id=conv_id,
        related_entity_type="conversation",
    )
    db.add(notif)
    db.commit()

    # Dispatch Real Device Push Notification
    from app.services.push_notification_service import push_service
    push_service.send_push_to_user(
        db=db,
        user_id=receiver_id,
        title=push_title,
        message=push_body,
        notification_type="expert_message" if current_user.role == UserRole.EXPERT else "officer_message",
        screen="chat",
        record_id=str(conv_id),
        create_in_app=False,
    )

    return {"message": _msg_to_dict(msg)}


def _msg_to_dict(m: Message) -> dict:
    return {
        "id": str(m.id),
        "conversation_id": str(m.conversation_id),
        "sender_id": str(m.sender_id) if m.sender_id else None,
        "receiver_id": str(m.receiver_id) if m.receiver_id else None,
        "sender_name": m.sender.name if m.sender else None,
        "message_type": m.message_type.value if m.message_type else "text",
        "content": m.content,
        "attachment_url": m.attachment_url,
        "metadata": m.msg_metadata,
        "is_read": m.is_read,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
