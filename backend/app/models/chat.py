from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum
from app.models.types import GUID, JSONType
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime
import enum


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    DISEASE_RESULT = "disease_result"
    FARM_SHARE = "farm_share"
    SYSTEM = "system"


class ExpertProfile(Base):
    __tablename__ = "expert_profiles"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    specialization = Column(String(255), nullable=True)
    qualifications = Column(Text, nullable=True)
    years_experience = Column(String(10), nullable=True)
    crops_expertise = Column(JSONType, nullable=True)
    is_online = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    rating = Column(String(5), nullable=True)
    total_consultations = Column(String(20), default="0")
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="expert_profile")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    farmer_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expert_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(GUID, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    receiver_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    message_type = Column(Enum(MessageType), default=MessageType.TEXT)
    content = Column(Text, nullable=True)
    attachment_url = Column(String(500), nullable=True)
    msg_metadata = Column("metadata", JSONType, nullable=True)  # for disease_result, farm_share payloads
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")


class AIConversation(Base):
    """Conversation thread with AgriGuard AI Assistant"""
    __tablename__ = "ai_conversations"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Agricultural Chat")
    context_summary = Column(Text, nullable=True)
    status = Column(String(50), default="active", index=True)
    last_message_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="AIMessage.created_at")


class AIMessage(Base):
    """Message exchanged in AI Assistant conversation"""
    __tablename__ = "ai_messages"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(GUID, ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant, system
    sender_type = Column(String(30), default="USER", index=True)  # USER, AI_ASSISTANT, SYSTEM
    role_context = Column(String(30), default="FARMER", index=True)  # FARMER, OFFICER, EXPERT, ADMIN
    content = Column(Text, nullable=False)
    citations = Column(JSONType, nullable=True)  # retrieved knowledge chunks
    farm_context = Column(JSONType, nullable=True)  # active farm/crop/scan context
    model = Column(String(100), nullable=True)  # active AI model used
    model_version = Column(String(50), nullable=True)
    msg_metadata = Column("metadata", JSONType, nullable=True)  # confidence, citations, intent, tool_used, context_ids, etc.
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("AIConversation", back_populates="messages")


