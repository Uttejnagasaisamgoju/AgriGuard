import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.models.types import GUID
from app.database.session import Base


class PushSubscription(Base):
    """
    Stores device push subscription tokens per user.
    Supports Web Push (endpoint, p256dh, auth) and native device tokens (FCM/APNs/Capacitor).
    """
    __tablename__ = "push_subscriptions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(Text, nullable=False, index=True)
    p256dh = Column(Text, nullable=True)
    auth = Column(Text, nullable=True)
    subscription_type = Column(String(50), default="web_push")  # "web_push", "fcm", "apns", "capacitor"
    device_info = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="push_subscriptions")
    delivery_logs = relationship("PushDeliveryLog", back_populates="subscription", cascade="all, delete-orphan")


class NotificationPreferences(Base):
    """
    User notification preferences per category.
    Strictly controls whether push notifications are dispatched to the device.
    """
    __tablename__ = "notification_preferences"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    push_enabled = Column(Boolean, default=True)
    disease_alerts = Column(Boolean, default=True)
    expert_messages = Column(Boolean, default=True)
    officer_updates = Column(Boolean, default=True)
    weather_alerts = Column(Boolean, default=True)
    system_updates = Column(Boolean, default=True)
    sound_enabled = Column(Boolean, default=True)
    vibration_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notification_preferences")


class PushDeliveryLog(Base):
    """
    Audit log of push delivery attempts, capturing successes, failures (e.g. 410 Gone, expired tokens),
    and error messages for full observability.
    """
    __tablename__ = "push_delivery_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(GUID, ForeignKey("push_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    notification_type = Column(String(50), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, index=True)  # "delivered", "failed", "expired"
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    endpoint_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
    subscription = relationship("PushSubscription", back_populates="delivery_logs")
