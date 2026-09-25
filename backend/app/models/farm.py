from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, Date, Enum
from app.models.types import GUID, JSONType
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime
import enum


class SoilType(str, enum.Enum):
    CLAY = "clay"
    SANDY = "sandy"
    LOAMY = "loamy"
    SILT = "silt"
    PEATY = "peaty"
    CHALKY = "chalky"
    OTHER = "other"


class IrrigationType(str, enum.Enum):
    DRIP = "drip"
    SPRINKLER = "sprinkler"
    FLOOD = "flood"
    FURROW = "furrow"
    RAIN_FED = "rain_fed"
    OTHER = "other"


class Farm(Base):
    __tablename__ = "farms"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    boundary_geojson = Column(JSONType, nullable=True)
    area_hectares = Column(Float, nullable=True)
    crop_type = Column(String(100), nullable=True)
    crop_variety = Column(String(100), nullable=True)
    planting_date = Column(Date, nullable=True)
    sowing_date = Column(Date, nullable=True)
    soil_type = Column(Enum(SoilType), nullable=True)
    irrigation_type = Column(Enum(IrrigationType), nullable=True)
    address = Column(String(500), nullable=True)
    village = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), default="India")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="farms")
    predictions = relationship("DiseasePrediction", back_populates="farm")
    officer_cases = relationship("OfficerCase", back_populates="farm")
    weather_records = relationship("WeatherRecord", back_populates="farm", cascade="all, delete-orphan")
    satellite_images = relationship("SatelliteImage", back_populates="farm", cascade="all, delete-orphan")
    field_visits = relationship("FieldVisit", back_populates="farm")
    treatments = relationship("FarmTreatment", back_populates="farm", cascade="all, delete-orphan")
    saved_reports = relationship("FarmReport", back_populates="farm", cascade="all, delete-orphan")
