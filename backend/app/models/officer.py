from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum, Float, Integer
from app.models.types import GUID, JSONType
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime
import enum


class CaseStatus(str, enum.Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    FIELD_VISIT_REQUIRED = "FIELD_VISIT_REQUIRED"
    TREATMENT_RECOMMENDED = "TREATMENT_RECOMMENDED"
    RESOLVED = "RESOLVED"


class OfficerCase(Base):
    __tablename__ = "officer_cases"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    officer_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    farmer_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="SET NULL"), nullable=True)
    prediction_id = Column(GUID, ForeignKey("disease_predictions.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(CaseStatus), default=CaseStatus.NEW, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    officer_notes = Column(Text, nullable=True)
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    officer = relationship("User", foreign_keys=[officer_id], back_populates="officer_cases_assigned")
    farmer = relationship("User", foreign_keys=[farmer_id], back_populates="officer_cases_farmer")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    farm = relationship("Farm", back_populates="officer_cases")
    prediction = relationship("DiseasePrediction", back_populates="officer_case")
    field_visits = relationship("FieldVisit", back_populates="case", cascade="all, delete-orphan")
    field_reports = relationship("FieldReport", back_populates="case", cascade="all, delete-orphan")


class FieldVisit(Base):
    __tablename__ = "field_visits"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    case_id = Column(GUID, ForeignKey("officer_cases.id", ondelete="CASCADE"), nullable=False)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="SET NULL"), nullable=True)
    officer_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_date = Column(DateTime, nullable=False)
    completed_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="scheduled")  # scheduled, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("OfficerCase", back_populates="field_visits")
    farm = relationship("Farm", back_populates="field_visits")


class FieldReport(Base):
    __tablename__ = "field_reports"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    case_id = Column(GUID, ForeignKey("officer_cases.id", ondelete="CASCADE"), nullable=False)
    officer_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    images = Column(JSONType, nullable=True)
    recommendations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("OfficerCase", back_populates="field_reports")

