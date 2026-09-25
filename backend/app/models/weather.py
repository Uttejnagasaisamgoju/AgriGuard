from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer, Text
from app.models.types import GUID, JSONType
from sqlalchemy.orm import relationship
from app.database.session import Base
import uuid
from datetime import datetime


class WeatherRecord(Base):
    __tablename__ = "weather_records"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    temperature = Column(Float, nullable=True)
    feels_like = Column(Float, nullable=True)
    humidity = Column(Integer, nullable=True)
    wind_speed = Column(Float, nullable=True)
    wind_direction = Column(Integer, nullable=True)
    rain_probability = Column(Float, nullable=True)
    description = Column(String(255), nullable=True)
    icon = Column(String(50), nullable=True)
    pressure = Column(Float, nullable=True)
    visibility = Column(Float, nullable=True)
    uv_index = Column(Float, nullable=True)
    forecast = Column(JSONType, nullable=True)
    raw_response = Column(JSONType, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    farm = relationship("Farm", back_populates="weather_records")


class SatelliteImage(Base):
    __tablename__ = "satellite_images"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    image_type = Column(String(50), nullable=False)  # true_color, ndvi, ndwi, moisture
    image_url = Column(String(500), nullable=True)
    ndvi_min = Column(Float, nullable=True)
    ndvi_max = Column(Float, nullable=True)
    ndvi_mean = Column(Float, nullable=True)
    cloud_coverage = Column(Float, nullable=True)
    acquisition_date = Column(DateTime, nullable=True)
    img_metadata = Column("metadata", JSONType, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    farm = relationship("Farm", back_populates="satellite_images")

