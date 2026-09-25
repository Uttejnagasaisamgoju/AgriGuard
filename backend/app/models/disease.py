from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, Integer, Enum, Boolean
from app.models.types import GUID, JSONType
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime
import enum


class DiseaseCategory(str, enum.Enum):
    FUNGAL = "fungal"
    BACTERIAL = "bacterial"
    VIRAL = "viral"
    PEST = "pest"
    NUTRITIONAL = "nutritional"
    ENVIRONMENTAL = "environmental"
    OTHER = "other"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Disease(Base):
    """Disease library entry"""
    __tablename__ = "diseases"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, index=True)
    scientific_name = Column(String(255), nullable=True)
    crop_type = Column(String(100), nullable=False, index=True)
    category = Column(Enum(DiseaseCategory), nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False, default=RiskLevel.MEDIUM)
    symptoms = Column(Text, nullable=True)
    causes = Column(Text, nullable=True)
    affected_parts = Column(JSONType, nullable=True)
    prevention = Column(Text, nullable=True)
    management = Column(Text, nullable=True)
    treatment = Column(Text, nullable=True)
    favorable_conditions = Column(Text, nullable=True)
    reference_images = Column(JSONType, nullable=True)
    ml_class_name = Column(String(255), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    predictions = relationship("DiseasePrediction", back_populates="disease")


class DiseasePrediction(Base):
    """Result of ML disease detection"""
    __tablename__ = "disease_predictions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="SET NULL"), nullable=True, index=True)
    disease_id = Column(GUID, ForeignKey("diseases.id", ondelete="SET NULL"), nullable=True)
    model_version = Column(String(50), nullable=True)

    # Per-image results stored as JSON array
    image_results = Column(JSONType, nullable=False)  # [{image_path, disease, confidence, top_predictions}]

    # Aggregated result
    primary_disease = Column(String(255), nullable=True)
    primary_crop = Column(String(100), nullable=True)
    overall_confidence = Column(Float, nullable=True)
    severity = Column(String(50), nullable=True)
    recommendations = Column(JSONType, nullable=True)

    # Status
    status = Column(String(50), default="completed")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="predictions")
    farm = relationship("Farm", back_populates="predictions")
    disease = relationship("Disease", back_populates="predictions")
    officer_case = relationship("OfficerCase", back_populates="prediction", uselist=False)


class ModelVersion(Base):
    """Track ML model versions"""
    __tablename__ = "model_versions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    version = Column(String(50), nullable=False, unique=True)
    architecture = Column(String(100), nullable=True)
    model_path = Column(String(500), nullable=False)
    training_dataset = Column(String(255), nullable=True)
    training_date = Column(DateTime, nullable=True)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    num_classes = Column(Integer, nullable=True)
    classes = Column(JSONType, nullable=True)
    status = Column(String(50), default="active")  # active, deprecated, testing
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ImageValidation(Base):
    """Record of pre-analysis leaf image validation"""
    __tablename__ = "image_validations"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = Column(String(500), nullable=False)
    is_valid = Column(Boolean, nullable=False, default=False)
    leaf_probability = Column(Float, nullable=False, default=0.0)
    blur_score = Column(Float, nullable=False, default=0.0)
    brightness_score = Column(Float, nullable=False, default=0.0)
    leaf_area_ratio = Column(Float, nullable=False, default=0.0)
    screen_probability = Column(Float, nullable=False, default=0.0)
    reason = Column(String(255), nullable=True)
    meta_info = Column(JSONType, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeDocument(Base):
    """Agricultural knowledge base document for RAG"""
    __tablename__ = "knowledge_documents"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False, index=True)
    source = Column(String(255), nullable=False)
    crop = Column(String(100), nullable=True, index=True)
    disease = Column(String(100), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    content = Column(Text, nullable=False)
    last_verified = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExpertFeedback(Base):
    """Labeled expert feedback for plant pathology corrections and future retraining"""
    __tablename__ = "expert_feedback"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    prediction_id = Column(GUID, ForeignKey("disease_predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    image_id = Column(String(255), nullable=True)
    image_path = Column(String(500), nullable=True)
    original_prediction = Column(String(255), nullable=False)
    original_confidence = Column(Float, nullable=False)
    original_model_version = Column(String(50), nullable=True)
    expert_label = Column(String(255), nullable=False)
    reviewer_role = Column(String(50), default="EXPERT")  # EXPERT, OFFICER
    reviewer_decision = Column(String(50), default="CONFIRMED")  # CONFIRMED, CORRECTED, HEALTHY, INVALID, UNCERTAIN
    corrected_severity = Column(String(50), nullable=True)
    corrected_stage = Column(String(50), nullable=True)
    expert_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    crop = Column(String(100), nullable=True)
    disease = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=True)
    consent_given = Column(Boolean, default=True)
    quality_score = Column(Float, default=1.0)
    training_state = Column(String(50), default="training_eligible")  # submitted, quality_checked, awaiting_label, expert_confirmed, officer_confirmed, rejected, training_eligible, training_used
    dataset_version = Column(String(50), default="Dataset-v2")
    created_at = Column(DateTime, default=datetime.utcnow)



