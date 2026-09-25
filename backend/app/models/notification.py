from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum
from app.models.types import GUID
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime
import enum


class NotificationType(str, enum.Enum):
    DISEASE_ALERT = "disease_alert"
    OFFICER_MESSAGE = "officer_message"
    EXPERT_MESSAGE = "expert_message"
    FIELD_VISIT = "field_visit"
    CASE_UPDATE = "case_update"
    SYSTEM = "system"
    WEATHER_ALERT = "weather_alert"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    related_entity_id = Column(String(255), nullable=True)  # e.g. prediction ID, case ID
    related_entity_type = Column(String(100), nullable=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

