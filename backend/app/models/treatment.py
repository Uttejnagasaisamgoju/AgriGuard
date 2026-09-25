from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.models.types import GUID
from app.database.session import Base
import uuid
from datetime import datetime


class FarmTreatment(Base):
    """Real treatment / agricultural action recorded on a farm"""
    __tablename__ = "farm_treatments"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    related_disease = Column(String(255), nullable=True)
    prediction_id = Column(GUID, ForeignKey("disease_predictions.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_name = Column(String(255), nullable=True)
    recorded_by_role = Column(String(50), default="FARMER")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    farm = relationship("Farm", back_populates="treatments")
    user = relationship("User")
    prediction = relationship("DiseasePrediction")
