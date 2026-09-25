from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.models.types import GUID, JSONType
from app.database.session import Base
import uuid
from datetime import datetime


class FarmReport(Base):
    """Historical generated PDF / snapshot reports for a farm"""
    __tablename__ = "farm_reports"

    id = Column(GUID, primary_key=True, default=uuid.uuid4, index=True)
    farm_id = Column(GUID, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_type = Column(String(50), default="health_summary")
    period = Column(String(50), default="all_time")
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    summary_data = Column(JSONType, nullable=True)
    status = Column(String(50), default="completed")
    download_count = Column(Integer, default=1)
    generated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    farm = relationship("Farm", back_populates="saved_reports")
    user = relationship("User")
