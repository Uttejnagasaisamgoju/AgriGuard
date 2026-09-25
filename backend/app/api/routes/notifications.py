from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from app.database.session import get_db
from app.models.notification import Notification, NotificationType
from app.models.push import PushSubscription, NotificationPreferences, PushDeliveryLog
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.push_notification_service import push_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class PushSubscriptionSchema(BaseModel):
    endpoint: str
    keys: Optional[Dict[str, str]] = None
    subscription_type: Optional[str] = "web_push"
    device_info: Optional[str] = None


class NotificationPreferencesUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    disease_alerts: Optional[bool] = None
    expert_messages: Optional[bool] = None
    officer_updates: Optional[bool] = None
    weather_alerts: Optional[bool] = None
    system_updates: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    vibration_enabled: Optional[bool] = None


# ── In-App Notifications Endpoints ──────────────────────────────────────────

@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    skip: int = 0,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    total_unread = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    query = query.order_by(Notification.created_at.desc())
    total = query.count()
    notifications = query.offset(skip).limit(limit).all()
    return {
        "notifications": [_notif_to_dict(n) for n in notifications],
        "total": total,
        "unread_count": total_unread,
    }


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()
    return {"message": "All notifications marked as read"}


# ── Push Notification & VAPID Endpoints ──────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """
    Returns the server's VAPID public key so client browsers or native wrappers
    can subscribe to Web Push using standard applicationServerKey.
    """
    return {
        "public_key": push_service.get_public_key()
    }


@router.post("/subscribe")
async def subscribe_device(
    payload: PushSubscriptionSchema,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Registers or refreshes a device push subscription for the logged-in user.
    Handles token rotation, prevents duplicates, and associates device details.
    """
    try:
        user_agent = request.headers.get("user-agent", "Unknown Device")
        device_info = payload.device_info or user_agent[:250]

        sub = push_service.register_or_update_subscription(
            db=db,
            user_id=current_user.id,
            subscription_data=payload.dict(),
            device_info=device_info
        )
        return {
            "status": "success",
            "message": "Device push subscription registered successfully",
            "subscription_id": str(sub.id)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to register subscription: {str(e)}")


@router.post("/unsubscribe")
async def unsubscribe_device(
    payload: Dict[str, str] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deactivates or removes a push subscription for the given endpoint.
    """
    endpoint = payload.get("endpoint", "")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Endpoint is required")

    success = push_service.remove_subscription(db, current_user.id, endpoint)
    return {
        "status": "success" if success else "not_found",
        "message": "Device unsubscribed from push notifications"
    }


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves user notification preferences for all categories.
    """
    prefs = push_service.get_or_create_preferences(db, current_user.id)
    return {
        "push_enabled": prefs.push_enabled,
        "disease_alerts": prefs.disease_alerts,
        "expert_messages": prefs.expert_messages,
        "officer_updates": prefs.officer_updates,
        "weather_alerts": prefs.weather_alerts,
        "system_updates": prefs.system_updates,
        "sound_enabled": prefs.sound_enabled,
        "vibration_enabled": prefs.vibration_enabled,
        "updated_at": prefs.updated_at.isoformat() if prefs.updated_at else None
    }


@router.put("/preferences")
async def update_preferences(
    updates: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates user notification preferences. Changes take effect immediately.
    """
    filtered = {k: v for k, v in updates.dict().items() if v is not None}
    prefs = push_service.update_preferences(db, current_user.id, filtered)
    return {
        "status": "success",
        "message": "Notification preferences updated successfully",
        "preferences": {
            "push_enabled": prefs.push_enabled,
            "disease_alerts": prefs.disease_alerts,
            "expert_messages": prefs.expert_messages,
            "officer_updates": prefs.officer_updates,
            "weather_alerts": prefs.weather_alerts,
            "system_updates": prefs.system_updates,
            "sound_enabled": prefs.sound_enabled,
            "vibration_enabled": prefs.vibration_enabled,
        }
    }


@router.post("/test-push")
async def send_test_push(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sends a test push notification to all active devices of the caller to verify
    end-to-end device delivery and deep linking.
    """
    result = push_service.send_push_to_user(
        db=db,
        user_id=current_user.id,
        title="AgriGuard Device Test",
        message="Push alerts and deep linking are active on this device! Tap to open Disease Detection.",
        notification_type="system",
        screen="disease-detect",
        create_in_app=True
    )
    return result


@router.get("/delivery-logs")
async def get_delivery_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves recent push delivery attempts for audit, logging, and failure analysis.
    """
    logs = db.query(PushDeliveryLog).filter(
        PushDeliveryLog.user_id == current_user.id
    ).order_by(PushDeliveryLog.created_at.desc()).limit(limit).all()

    return {
        "logs": [
            {
                "id": str(l.id),
                "title": l.title,
                "notification_type": l.notification_type,
                "status": l.status,
                "status_code": l.status_code,
                "error_message": l.error_message,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs
        ]
    }


def _notif_to_dict(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type.value if n.type else None,
        "title": n.title,
        "message": n.message,
        "related_entity_id": n.related_entity_id,
        "related_entity_type": n.related_entity_type,
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
