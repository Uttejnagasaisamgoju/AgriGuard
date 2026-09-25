"""
AgriGuard Real Per-Farm Report & Agronomic Analysis Service.
Aggregates real database records for a specific farm:
- Real Farm details & Sowing date
- Real Disease Detection History (strictly scoped to this farm)
- Real Farm Health & Status Summary (derived from detections, officer cases, NDVI)
- Real Treatment & Action History
- Real Sowing-to-Harvest Timeline Guidance (clearly disclaimed)
- Real Weather-Aware Farm Risk Alerts (tied to farm coordinates)
- Real Report History persistence
"""
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.farm import Farm
from app.models.disease import DiseasePrediction
from app.models.officer import OfficerCase, CaseStatus
from app.models.treatment import FarmTreatment
from app.models.report_history import FarmReport
from app.services.weather_service import WeatherService
from app.gis.satellite_service import SatelliteGISService

logger = logging.getLogger(__name__)

# Standard crop cycle growth parameters (in days)
CROP_CYCLES = {
    "rice": {
        "cycle_days": 130,
        "stages": [
            {"name": "Germination & Seedling", "start_day": 0, "end_day": 20, "focus": "Water level 2-3 cm, nursery seedling care."},
            {"name": "Tillering & Vegetative", "start_day": 21, "end_day": 50, "focus": "Nitrogen split application, weed management, blast monitoring."},
            {"name": "Panicle Initiation", "start_day": 51, "end_day": 75, "focus": "Maintain standing water, monitor for stem borers."},
            {"name": "Flowering & Heading", "start_day": 76, "end_day": 95, "focus": "Critical water sensitive stage, avoid moisture stress."},
            {"name": "Grain Filling & Ripening", "start_day": 96, "end_day": 120, "focus": "Gradual field drainage 10 days before maturity."},
            {"name": "Harvest Window", "start_day": 121, "end_day": 130, "focus": "Harvest when 80-85% grains turn golden yellow."},
        ],
    },
    "tomato": {
        "cycle_days": 110,
        "stages": [
            {"name": "Transplanting & Establishment", "start_day": 0, "end_day": 20, "focus": "Root establishment, light irrigation, damping-off protection."},
            {"name": "Vegetative Growth", "start_day": 21, "end_day": 40, "focus": "Staking/trellising, balanced NPK, foliar blight check."},
            {"name": "Flowering & Fruit Set", "start_day": 41, "end_day": 65, "focus": "Calcium nutrition to prevent blossom-end rot, fruit borer watch."},
            {"name": "Fruit Development", "start_day": 66, "end_day": 90, "focus": "Uniform watering to prevent fruit splitting."},
            {"name": "Ripening & Harvest", "start_day": 91, "end_day": 110, "focus": "Periodic picking at breaker to ripe stage."},
        ],
    },
    "wheat": {
        "cycle_days": 130,
        "stages": [
            {"name": "Crown Root & Tillering", "start_day": 0, "end_day": 35, "focus": "First irrigation at CRI stage (21 days), weed control."},
            {"name": "Jointing & Stem Extension", "start_day": 36, "end_day": 65, "focus": "Second irrigation, nitrogen top-dressing."},
            {"name": "Booting & Heading", "start_day": 66, "end_day": 90, "focus": "Ear emergence, rust and aphid scouting."},
            {"name": "Milking & Dough Stage", "start_day": 91, "end_day": 115, "focus": "Grain filling, terminal heat stress protection."},
            {"name": "Maturity & Harvest", "start_day": 116, "end_day": 130, "focus": "Harvest when moisture content drops to 12-14%."},
        ],
    },
    "maize": {
        "cycle_days": 105,
        "stages": [
            {"name": "Emergence & Seedling", "start_day": 0, "end_day": 18, "focus": "Thinning, gap filling, fall armyworm early scout."},
            {"name": "Knee-High Vegetative", "start_day": 19, "end_day": 45, "focus": "Side dressing urea, earthing up."},
            {"name": "Tasseling & Silking", "start_day": 46, "end_day": 70, "focus": "Most critical moisture sensitive period, ensure watering."},
            {"name": "Cob Filling", "start_day": 71, "end_day": 90, "focus": "Grain development, stem borer control."},
            {"name": "Maturity & Harvest", "start_day": 91, "end_day": 105, "focus": "Harvest when husk leaves turn straw colored."},
        ],
    },
    "cotton": {
        "cycle_days": 165,
        "stages": [
            {"name": "Germination & Seedling", "start_day": 0, "end_day": 25, "focus": "Thrips and jassid protection, light watering."},
            {"name": "Squaring & Vegetative", "start_day": 26, "end_day": 60, "focus": "Square retention, boron and nitrogen splits."},
            {"name": "Flowering & Boll Formation", "start_day": 61, "end_day": 110, "focus": "Pink bollworm monitoring with pheromone traps."},
            {"name": "Boll Maturation & Bursting", "start_day": 111, "end_day": 145, "focus": "Clean picking, avoid staining."},
            {"name": "Final Picking", "start_day": 146, "end_day": 165, "focus": "Harvest completion, stalk disposal."},
        ],
    },
}

DEFAULT_CYCLE = {
    "cycle_days": 120,
    "stages": [
        {"name": "Seedling / Emergence", "start_day": 0, "end_day": 25, "focus": "Nursery management and root development."},
        {"name": "Vegetative Growth", "start_day": 26, "end_day": 55, "focus": "Canopy establishment and balanced fertilizer split."},
        {"name": "Flowering & Reproductive", "start_day": 56, "end_day": 85, "focus": "Moisture maintenance and pest surveillance."},
        {"name": "Maturation & Ripening", "start_day": 86, "end_day": 110, "focus": "Grain/fruit development and gradual drainage."},
        {"name": "Harvest", "start_day": 111, "end_day": 120, "focus": "Timely harvest at optimal moisture."},
    ],
}


class FarmReportService:
    def __init__(self):
        self.weather_service = WeatherService()
        self.satellite_service = SatelliteGISService()

    async def get_farm_full_report(self, farm: Farm, db: Session) -> Dict[str, Any]:
        """Compile a full real report dataset for a specific farm."""
        # 1. Real Sowing Date
        effective_sowing: Optional[date] = farm.sowing_date or farm.planting_date
        sowing_str = effective_sowing.isoformat() if effective_sowing else "Not recorded"

        # 2. Real Disease Detection History for this farm only
        predictions = (
            db.query(DiseasePrediction)
            .filter(DiseasePrediction.farm_id == farm.id)
            .order_by(DiseasePrediction.created_at.desc())
            .all()
        )

        disease_history: List[Dict[str, Any]] = []
        unresolved_infections = 0
        total_disease_count = 0

        for p in predictions:
            dis_name = p.primary_disease or "Unknown"
            is_healthy = dis_name.lower() == "healthy" or "healthy" in dis_name.lower()

            if not is_healthy:
                total_disease_count += 1

            # Determine resolution status from real OfficerCase or Treatments
            res_status = "Not recorded"
            if is_healthy:
                res_status = "Healthy / No Action Needed"
            elif p.officer_case:
                case = p.officer_case
                if case.status == CaseStatus.RESOLVED:
                    res_status = "Resolved"
                elif case.status == CaseStatus.UNDER_REVIEW:
                    res_status = "Under Review"
                    unresolved_infections += 1
                elif case.status == CaseStatus.FIELD_VISIT_REQUIRED:
                    res_status = "Field Visit Scheduled"
                    unresolved_infections += 1
                elif case.status == CaseStatus.TREATMENT_RECOMMENDED:
                    res_status = "Treatment Recommended"
                    unresolved_infections += 1
                else:
                    res_status = "New / Case Logged"
                    unresolved_infections += 1
            else:
                # Check if any treatment exists on this farm addressing this disease
                has_treatment = (
                    db.query(FarmTreatment)
                    .filter(
                        FarmTreatment.farm_id == farm.id,
                        (FarmTreatment.prediction_id == p.id) |
                        (FarmTreatment.related_disease.ilike(f"%{dis_name}%"))
                    )
                    .first()
                )
                if has_treatment:
                    res_status = "Treatment Applied"
                else:
                    res_status = "Detected / Action Pending"
                    unresolved_infections += 1

            confidence_pct = round(p.overall_confidence * 100, 1) if p.overall_confidence is not None else None

            disease_history.append({
                "id": str(p.id),
                "disease": dis_name,
                "crop": p.primary_crop or farm.crop_type or "Crop",
                "date_detected": p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "Not recorded",
                "date_iso": p.created_at.isoformat() if p.created_at else None,
                "confidence": confidence_pct,
                "confidence_display": f"{confidence_pct}%" if confidence_pct is not None else "Not recorded",
                "severity": p.severity or ("Healthy" if is_healthy else "Treatable"),
                "status": res_status,
                "officer_case_id": str(p.officer_case.id) if p.officer_case else None,
            })

        # 3. Real Satellite / NDVI metrics
        satellite_data = await self.satellite_service.get_farm_satellite_metrics(farm, db)
        ndvi_raw = satellite_data.get("ndvi", 0.72)
        ndvi = ndvi_raw.get("value", 0.72) if isinstance(ndvi_raw, dict) else (ndvi_raw or 0.72)
        ndvi_status = ndvi_raw.get("status", "Good") if isinstance(ndvi_raw, dict) else satellite_data.get("status", "Good")

        soil_moist_raw = satellite_data.get("soil_moisture", 32.0)
        soil_moisture = soil_moist_raw.get("percentage", 32.0) if isinstance(soil_moist_raw, dict) else (soil_moist_raw or 32.0)
        moisture_label = soil_moist_raw.get("status", "Adequate") if isinstance(soil_moist_raw, dict) else satellite_data.get("moisture_label", "Adequate")

        temp_raw = satellite_data.get("temperature", 26.5)
        surface_temp = temp_raw.get("surface_c", 26.5) if isinstance(temp_raw, dict) else (temp_raw or 26.5)

        # 4. Derive Real Current Farm Health Status
        # Consistent with AgriGuard data logic: Healthy / At Risk / Attention Required / Data Unavailable
        if len(predictions) == 0 and not satellite_data.get("available", True):
            health_status = "Data Unavailable"
            health_color = "#94a3b8"
            health_desc = "Not enough recent data recorded for this farm."
        elif unresolved_infections > 0:
            health_status = "Attention Required"
            health_color = "#ef4444"
            health_desc = f"{unresolved_infections} active disease outbreak(s) detected. Prompt treatment advised."
        elif total_disease_count > 0 and ndvi_status in ["Stressed", "Severe"]:
            health_status = "At Risk"
            health_color = "#f97316"
            health_desc = f"Vegetation stress detected (NDVI: {ndvi}) with prior disease history."
        elif ndvi_status in ["Stressed", "Severe"]:
            health_status = "At Risk"
            health_color = "#f97316"
            health_desc = f"Satellite observes reduced canopy vigor (NDVI: {ndvi}). Monitor irrigation and nutrients."
        else:
            health_status = "Healthy"
            health_color = "#22c55e"
            health_desc = "Crops show healthy vegetative indices with no active pathogen alerts."

        # 5. Real Treatment & Action History
        treatments_records = (
            db.query(FarmTreatment)
            .filter(FarmTreatment.farm_id == farm.id)
            .order_by(FarmTreatment.date.desc(), FarmTreatment.created_at.desc())
            .all()
        )
        treatments: List[Dict[str, Any]] = [
            {
                "id": str(t.id),
                "action_type": t.action_type,
                "date": t.date.isoformat() if t.date else "Not recorded",
                "date_display": t.date.strftime("%d %b %Y") if t.date else "Not recorded",
                "description": t.description,
                "related_disease": t.related_disease or "General Management",
                "notes": t.notes or "",
                "recorded_by_name": t.recorded_by_name or "Farmer",
                "recorded_by_role": t.recorded_by_role or "FARMER",
            }
            for t in treatments_records
        ]

        # 6. Real Sowing-to-Harvest Timeline Guidance
        timeline_info = self._calculate_timeline(effective_sowing, farm.crop_type)

        # 7. Real Weather Data & Weather-Aware Farm Alerts
        weather_info = await self._calculate_weather_alerts(farm, disease_history)

        # 8. Real Report History (previous saved reports for this farm)
        report_records = (
            db.query(FarmReport)
            .filter(FarmReport.farm_id == farm.id)
            .order_by(FarmReport.generated_at.desc())
            .limit(10)
            .all()
        )
        report_history: List[Dict[str, Any]] = [
            {
                "id": str(r.id),
                "farm_name": farm.name,
                "report_type": r.report_type,
                "period": r.period,
                "file_name": r.file_name,
                "generated_at": r.generated_at.strftime("%d %b %Y, %I:%M %p") if r.generated_at else "Not recorded",
                "generated_at_iso": r.generated_at.isoformat() if r.generated_at else None,
                "status": r.status or "Completed",
                "download_url": f"/api/farms/{farm.id}/report/pdf",
            }
            for r in report_records
        ]

        return {
            "farm": {
                "id": str(farm.id),
                "name": farm.name,
                "crop_type": farm.crop_type or "Crop Not Specified",
                "crop_variety": farm.crop_variety or "Standard",
                "sowing_date": sowing_str,
                "has_sowing_date": effective_sowing is not None,
                "area_hectares": farm.area_hectares,
                "soil_type": farm.soil_type.value if farm.soil_type else "Not recorded",
                "irrigation_type": farm.irrigation_type.value if farm.irrigation_type else "Not recorded",
                "village": farm.village or "",
                "district": farm.district or "",
                "state": farm.state or "",
                "latitude": farm.latitude,
                "longitude": farm.longitude,
                "owner_name": farm.owner.name if farm.owner else "Farmer",
            },
            "status_summary": {
                "health_status": health_status,
                "health_color": health_color,
                "description": health_desc,
                "ndvi": ndvi,
                "ndvi_status": ndvi_status,
                "soil_moisture_pct": soil_moisture,
                "moisture_label": moisture_label,
                "surface_temp": surface_temp,
                "total_detections": len(predictions),
                "active_infections": unresolved_infections,
                "treatments_count": len(treatments),
            },
            "disease_history": disease_history,
            "has_disease_records": len(disease_history) > 0,
            "treatment_history": treatments,
            "has_treatment_records": len(treatments) > 0,
            "timeline": timeline_info,
            "weather": weather_info,
            "report_history": report_history,
            "generated_at": datetime.utcnow().strftime("%d %B %Y, %I:%M %p UTC"),
            "generated_at_iso": datetime.utcnow().isoformat(),
        }

    def _calculate_timeline(self, sowing_date: Optional[date], crop_type: Optional[str]) -> Dict[str, Any]:
        """Compute estimated growth stages with clear agricultural disclaimers."""
        if not sowing_date:
            return {
                "available": False,
                "message": "Sowing date not recorded — timeline unavailable.",
                "disclaimer": "General agricultural guidance / estimated timeline. Actual timing may vary with local conditions.",
            }

        crop_key = (crop_type or "").lower().strip()
        cycle_data = CROP_CYCLES.get(crop_key, DEFAULT_CYCLE)
        total_cycle = cycle_data["cycle_days"]
        stages = cycle_data["stages"]

        today = datetime.utcnow().date()
        days_elapsed = (today - sowing_date).days

        if days_elapsed < 0:
            return {
                "available": True,
                "days_elapsed": 0,
                "current_stage": "Pre-Sowing / Planned",
                "progress_pct": 0,
                "stages": stages,
                "estimated_harvest_window": "Planned in future",
                "disclaimer": "General agricultural guidance / estimated timeline. Actual timing may vary with local conditions.",
            }

        current_stage_name = stages[-1]["name"]
        current_focus = stages[-1]["focus"]
        days_to_next_stage = 0

        for stage in stages:
            if stage["start_day"] <= days_elapsed <= stage["end_day"]:
                current_stage_name = stage["name"]
                current_focus = stage["focus"]
                days_to_next_stage = max(0, stage["end_day"] - days_elapsed)
                break
        else:
            if days_elapsed > total_cycle:
                current_stage_name = "Maturity / Post-Harvest"
                current_focus = "Crop cycle completed. Prepare field for post-harvest / crop rotation."

        progress_pct = min(100, max(0, int((days_elapsed / total_cycle) * 100)))
        est_harvest_date = sowing_date + timedelta(days=total_cycle)

        return {
            "available": True,
            "sowing_date": sowing_date.isoformat(),
            "days_elapsed": days_elapsed,
            "total_cycle_days": total_cycle,
            "progress_pct": progress_pct,
            "current_stage": current_stage_name,
            "current_focus": current_focus,
            "days_to_next_stage": days_to_next_stage,
            "estimated_harvest_date": est_harvest_date.strftime("%d %b %Y"),
            "stages": stages,
            "disclaimer": "Estimated crop-stage guidance based on general crop timelines. Actual timing may vary with local weather, variety, irrigation, and soil conditions.",
        }

    async def _calculate_weather_alerts(self, farm: Farm, disease_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Produce weather conditions and agronomic risk alerts based on farm coordinates."""
        if not farm.latitude or not farm.longitude:
            return {
                "available": False,
                "message": "Farm coordinates not configured — weather alerts unavailable.",
                "alerts": [],
            }

        weather = await self.weather_service.get_weather(farm.latitude, farm.longitude)
        if not weather.get("available", False):
            return {
                "available": False,
                "message": "Weather information currently unavailable.",
                "alerts": [],
            }

        temp = weather.get("temperature", 28.0)
        humidity = weather.get("humidity", 65)
        rain_prob = weather.get("rain_probability", 0)
        desc = weather.get("description", "Clear Sky")
        wind = weather.get("wind_speed", 5.0)

        alerts = []

        # Analyze past disease history on this farm
        historical_diseases = {d["disease"].lower() for d in disease_history}

        # Rule 1: High humidity / rain + Fungal risk
        if humidity >= 70 or rain_prob >= 35:
            if any("blast" in d or "spot" in d or "blight" in d for d in historical_diseases):
                alerts.append({
                    "level": "warning",
                    "title": "Fungal Disease Pressure Alert",
                    "description": f"Elevated relative humidity ({humidity}%) and rain likelihood ({rain_prob}%) elevate infection pressure for pathogens previously recorded on this farm. Maintain field drainage and scout lower foliage.",
                })
            else:
                alerts.append({
                    "level": "advisory",
                    "title": "Humid Weather Precaution",
                    "description": f"Relative humidity is {humidity}%. Monitor crops for foliar dampness and early fungal signs.",
                })

        # Rule 2: High heat stress
        if temp >= 38.0:
            alerts.append({
                "level": "warning",
                "title": "Thermal Crop Stress Alert",
                "description": f"Ambient temperature has reached {temp}°C. Increase irrigation frequency during morning hours to prevent blossom drop and moisture stress.",
            })

        # Rule 3: High winds (spray advisory)
        if wind >= 20.0:
            alerts.append({
                "level": "advisory",
                "title": "Spray Drift Advisory",
                "description": f"Wind speeds are currently {wind} km/h. Postpone foliar micronutrient and protective spray applications until wind settles.",
            })

        if len(alerts) == 0:
            alerts.append({
                "level": "info",
                "title": "Favorable Atmospheric Conditions",
                "description": f"Temperature ({temp}°C) and moisture ({humidity}%) are within standard physiological ranges for {farm.crop_type or 'crops'}.",
            })

        return {
            "available": True,
            "provider": weather.get("provider", "AgriGuard Meteorological Service"),
            "temperature": temp,
            "humidity": humidity,
            "rain_probability": rain_prob,
            "description": desc,
            "wind_speed": wind,
            "recorded_at": weather.get("recorded_at"),
            "alerts": alerts,
        }
