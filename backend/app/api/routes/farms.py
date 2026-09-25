from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from app.database.session import get_db
from app.models.farm import Farm, SoilType, IrrigationType
from app.models.user import User
from app.models.treatment import FarmTreatment
from app.models.report_history import FarmReport
from app.auth.dependencies import get_current_user
from pydantic import BaseModel
import uuid
import json
import math
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/farms", tags=["Farms"])


class FarmCreate(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_geojson: Optional[dict] = None
    area_hectares: Optional[float] = None
    crop_type: Optional[str] = None
    crop_variety: Optional[str] = None
    planting_date: Optional[date] = None
    sowing_date: Optional[date] = None
    sowingDate: Optional[date] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_geojson: Optional[dict] = None
    area_hectares: Optional[float] = None
    crop_type: Optional[str] = None
    crop_variety: Optional[str] = None
    planting_date: Optional[date] = None
    sowing_date: Optional[date] = None
    sowingDate: Optional[date] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None


def calculate_polygon_area(geojson: dict) -> float:
    """Calculate polygon area in hectares using the shoelace formula (spherical Earth)"""
    try:
        if geojson.get("type") == "FeatureCollection":
            coords = geojson["features"][0]["geometry"]["coordinates"][0]
        elif geojson.get("type") == "Feature":
            coords = geojson["geometry"]["coordinates"][0]
        elif geojson.get("type") == "Polygon":
            coords = geojson["coordinates"][0]
        else:
            return 0.0

        # Shoelace on a sphere (approximate)
        R = 6371000  # Earth radius in meters
        n = len(coords)
        area = 0.0
        for i in range(n - 1):
            lon1, lat1 = math.radians(coords[i][0]), math.radians(coords[i][1])
            lon2, lat2 = math.radians(coords[(i + 1) % (n - 1)][0]), math.radians(coords[(i + 1) % (n - 1)][1])
            area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))

        area = abs(area) * R * R / 2
        return round(area / 10000, 4)  # Convert m² to hectares
    except Exception:
        return 0.0


def farm_to_dict(farm: Farm) -> dict:
    effective_sowing = (farm.sowing_date or farm.planting_date)
    sowing_iso = effective_sowing.isoformat() if effective_sowing else None

    return {
        "id": str(farm.id),
        "user_id": str(farm.user_id),
        "name": farm.name,
        "description": farm.description,
        "latitude": farm.latitude,
        "longitude": farm.longitude,
        "boundary_geojson": farm.boundary_geojson,
        "area_hectares": farm.area_hectares,
        "crop_type": farm.crop_type,
        "crop_variety": farm.crop_variety,
        "planting_date": sowing_iso,
        "sowing_date": sowing_iso,
        "sowingDate": sowing_iso,
        "soil_type": farm.soil_type.value if farm.soil_type else None,
        "irrigation_type": farm.irrigation_type.value if farm.irrigation_type else None,
        "address": farm.address,
        "village": farm.village,
        "district": farm.district,
        "state": farm.state,
        "country": farm.country,
        "created_at": farm.created_at.isoformat() if farm.created_at else None,
        "updated_at": farm.updated_at.isoformat() if farm.updated_at else None,
        "owner_name": farm.owner.name if farm.owner else None,
    }


@router.get("")
async def list_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role_str in ["OFFICER", "ADMIN", "EXPERT"]:
        farms = db.query(Farm).all()
    else:
        farms = db.query(Farm).filter(Farm.user_id == current_user.id).all()
    return {"farms": [farm_to_dict(f) for f in farms], "total": len(farms)}


@router.post("", status_code=201)
async def create_farm(
    req: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Strict Server-Side Role Authorization: Only Farmers (and Admins) may create farms
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role_str not in ["FARMER", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: {user_role_str.capitalize()} accounts are not authorized to create or register farms. Farm creation is strictly reserved for Farmer accounts."
        )

    area = req.area_hectares
    if req.boundary_geojson and not area:
        area = calculate_polygon_area(req.boundary_geojson)

    soil = None
    if req.soil_type:
        try:
            soil = SoilType(req.soil_type.lower())
        except ValueError:
            soil = SoilType.OTHER

    irrig = None
    if req.irrigation_type:
        try:
            irrig = IrrigationType(req.irrigation_type.lower())
        except ValueError:
            irrig = IrrigationType.OTHER

    sowing = req.sowing_date or req.sowingDate or req.planting_date

    farm = Farm(
        user_id=current_user.id,
        name=req.name,
        description=req.description,
        latitude=req.latitude,
        longitude=req.longitude,
        boundary_geojson=req.boundary_geojson,
        area_hectares=area,
        crop_type=req.crop_type,
        crop_variety=req.crop_variety,
        planting_date=sowing,
        sowing_date=sowing,
        soil_type=soil,
        irrigation_type=irrig,
        address=req.address,
        village=req.village,
        district=req.district,
        state=req.state,
        country=req.country or "India",
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return {"message": "Farm created successfully", "farm": farm_to_dict(farm)}


@router.get("/{farm_id}")
async def get_farm(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return farm_to_dict(farm)


@router.put("/{farm_id}")
async def update_farm(
    farm_id: str,
    req: FarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if str(farm.user_id) != str(current_user.id) and current_user.role.value not in ["ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = req.model_dump(exclude_none=True)

    # Synchronize sowing date aliases
    if any(k in update_data for k in ("sowing_date", "sowingDate", "planting_date")):
        sowing = update_data.get("sowing_date") or update_data.get("sowingDate") or update_data.get("planting_date")
        update_data["sowing_date"] = sowing
        update_data["planting_date"] = sowing
        update_data.pop("sowingDate", None)

    if "boundary_geojson" in update_data and update_data["boundary_geojson"]:
        if "area_hectares" not in update_data or not update_data["area_hectares"]:
            update_data["area_hectares"] = calculate_polygon_area(update_data["boundary_geojson"])

    if "soil_type" in update_data:
        try:
            update_data["soil_type"] = SoilType(update_data["soil_type"].lower())
        except ValueError:
            update_data["soil_type"] = SoilType.OTHER

    if "irrigation_type" in update_data:
        try:
            update_data["irrigation_type"] = IrrigationType(update_data["irrigation_type"].lower())
        except ValueError:
            update_data["irrigation_type"] = IrrigationType.OTHER

    for key, value in update_data.items():
        setattr(farm, key, value)

    farm.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(farm)
    return {"message": "Farm updated successfully", "farm": farm_to_dict(farm)}


@router.delete("/{farm_id}")
async def delete_farm(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if str(farm.user_id) != str(current_user.id) and current_user.role.value not in ["ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Safely nullify farm_id on related records to preserve historical disease predictions and officer cases
    try:
        from app.models.disease import DiseasePrediction
        db.query(DiseasePrediction).filter(DiseasePrediction.farm_id == farm.id).update(
            {DiseasePrediction.farm_id: None}, synchronize_session=False
        )
    except Exception:
        pass

    try:
        from app.models.officer import OfficerCase, FieldVisit
        db.query(OfficerCase).filter(OfficerCase.farm_id == farm.id).update(
            {OfficerCase.farm_id: None}, synchronize_session=False
        )
        db.query(FieldVisit).filter(FieldVisit.farm_id == farm.id).update(
            {FieldVisit.farm_id: None}, synchronize_session=False
        )
    except Exception:
        pass

    db.delete(farm)
    db.commit()
    return {"message": "Farm deleted successfully"}


from app.gis.satellite_service import SatelliteGISService
satellite_service = SatelliteGISService()


@router.get("/{farm_id}/satellite")
async def get_farm_satellite(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve real satellite NDVI, soil moisture, and land surface metrics for a farm"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    data = await satellite_service.get_farm_satellite_metrics(farm, db)
    return data


# ─── Farm Treatments & Action History ──────────────────────────────────────────

class TreatmentCreate(BaseModel):
    action_type: str
    date: date
    description: str
    related_disease: Optional[str] = None
    prediction_id: Optional[str] = None
    notes: Optional[str] = None


def treatment_to_dict(t: FarmTreatment) -> dict:
    return {
        "id": str(t.id),
        "farm_id": str(t.farm_id),
        "user_id": str(t.user_id),
        "action_type": t.action_type,
        "date": t.date.isoformat() if t.date else None,
        "description": t.description,
        "related_disease": t.related_disease,
        "prediction_id": str(t.prediction_id) if t.prediction_id else None,
        "notes": t.notes,
        "recorded_by_name": t.recorded_by_name,
        "recorded_by_role": t.recorded_by_role,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/{farm_id}/treatments")
async def get_farm_treatments(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve real recorded treatments and agricultural actions for a farm"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied")

    treatments = (
        db.query(FarmTreatment)
        .filter(FarmTreatment.farm_id == farm.id)
        .order_by(FarmTreatment.date.desc(), FarmTreatment.created_at.desc())
        .all()
    )
    return {"treatments": [treatment_to_dict(t) for t in treatments], "total": len(treatments)}


@router.post("/{farm_id}/treatments", status_code=201)
async def create_farm_treatment(
    farm_id: str,
    req: TreatmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a real treatment or field management action in the database"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to log actions on this farm")

    treatment = FarmTreatment(
        farm_id=farm.id,
        user_id=current_user.id,
        action_type=req.action_type.strip(),
        date=req.date,
        description=req.description.strip(),
        related_disease=req.related_disease.strip() if req.related_disease else None,
        prediction_id=req.prediction_id if req.prediction_id else None,
        notes=req.notes.strip() if req.notes else None,
        recorded_by_name=current_user.name,
        recorded_by_role=user_role_str,
    )
    db.add(treatment)
    db.commit()
    db.refresh(treatment)
    return {"message": "Treatment action recorded successfully", "treatment": treatment_to_dict(treatment)}


@router.delete("/{farm_id}/treatments/{treatment_id}")
async def delete_farm_treatment(
    farm_id: str,
    treatment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a treatment record"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    treatment = db.query(FarmTreatment).filter(FarmTreatment.id == treatment_id, FarmTreatment.farm_id == farm_id).first()
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment record not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(treatment)
    db.commit()
    return {"message": "Treatment record deleted successfully"}


# ─── Farm Reports & Genuine PDF Generation ──────────────────────────────────────

from app.services.farm_report_service import FarmReportService
from app.services.pdf_report_service import PDFReportService

farm_report_service = FarmReportService()
pdf_report_service = PDFReportService()


@router.get("/{farm_id}/report")
async def get_farm_report(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve authoritative, live per-farm report data:
    - Real Farm metadata & sowing date ('Not recorded' if missing)
    - Real Disease history belonging specifically to this farm
    - Real Farm health status derived from backend indicators
    - Real Treatment / action history
    - Real Sowing-to-harvest estimated guidance
    - Real Weather-aware alerts
    - Real Report history
    """
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view this farm's report")

    report = await farm_report_service.get_farm_full_report(farm, db)
    return report


@router.get("/{farm_id}/report/pdf")
async def download_farm_report_pdf(
    farm_id: str,
    lang: str = Query("en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate fresh, genuine production-grade PDF report for the farm:
    - Verifies farm authorization
    - Queries fresh real data from database
    - Generates PDF using ReportLab in the requested language
    - Persists generation log to farm_reports
    - Returns application/pdf attachment with dynamic filename
    """
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to download this report")

    # 1. Fetch fresh report data
    report_data = await farm_report_service.get_farm_full_report(farm, db)

    # 2. Build PDF binary with requested language
    try:
        pdf_bytes = pdf_report_service.build_farm_pdf(report_data, lang=lang)
    except Exception as e:
        logger.error(f"Failed to generate farm PDF for {farm_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate the PDF right now. Please try again.")

    # 3. Dynamic sanitized filename: AgriGuard_{Safe_Farm_Name}_Report_{YYYY-MM-DD}.pdf
    safe_name = pdf_report_service.sanitize_filename(farm.name)
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"AgriGuard_{safe_name}_Report_{date_str}.pdf"

    # 4. Persist in farm_reports table for genuine Report History
    try:
        report_record = FarmReport(
            farm_id=farm.id,
            user_id=current_user.id,
            report_type="health_summary",
            period="current",
            file_name=filename,
            summary_data={
                "health_status": report_data["status_summary"]["health_status"],
                "active_infections": report_data["status_summary"]["active_infections"],
                "total_detections": report_data["status_summary"]["total_detections"],
                "ndvi": report_data["status_summary"]["ndvi"],
            },
            status="completed",
            generated_at=datetime.utcnow(),
        )
        db.add(report_record)
        db.commit()
    except Exception as e:
        logger.warning(f"Error persisting farm report history: {e}")
        db.rollback()

    # 5. Return PDF with proper headers
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/{farm_id}/reports/history")
async def get_farm_report_history(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve history of previously generated reports for this farm"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied")

    reports = (
        db.query(FarmReport)
        .filter(FarmReport.farm_id == farm.id)
        .order_by(FarmReport.generated_at.desc())
        .limit(20)
        .all()
    )
    return {
        "reports": [
            {
                "id": str(r.id),
                "farm_id": str(r.farm_id),
                "farm_name": farm.name,
                "report_type": r.report_type,
                "period": r.period,
                "file_name": r.file_name,
                "generated_at": r.generated_at.strftime("%d %b %Y, %I:%M %p") if r.generated_at else "Not recorded",
                "generated_at_iso": r.generated_at.isoformat() if r.generated_at else None,
                "status": r.status or "Completed",
                "download_url": f"/api/farms/{farm.id}/report/pdf",
            }
            for r in reports
        ],
        "total": len(reports),
    }

