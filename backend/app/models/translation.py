import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime
from app.models.types import GUID
from app.database.session import Base

class TranslationMemory(Base):
    __tablename__ = "translation_memory"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    source_lang = Column(String(10), nullable=False, index=True)
    target_lang = Column(String(10), nullable=False, index=True)
    source_hash = Column(String(64), nullable=False, index=True)
    source_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    service = Column(String(50), default="google_v3")
    usage_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
