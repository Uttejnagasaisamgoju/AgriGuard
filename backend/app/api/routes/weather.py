from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.session import get_db
from app.models.farm import Farm
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.weather_service import WeatherService

router = APIRouter(prefix="/api/weather", tags=["Weather"])
weather_service = WeatherService()


@router.get("")
async def get_weather(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    farm_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if latitude is not None and lat is None:
        lat = latitude
    if longitude is not None and lon is None:
        lon = longitude

    if farm_id:
        farm = db.query(Farm).filter(Farm.id == farm_id).first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")
        if not farm.latitude or not farm.longitude:
            raise HTTPException(status_code=400, detail="Farm location not set. Please set farm coordinates first.")
        lat, lon = farm.latitude, farm.longitude

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Please provide lat/lon or a farm_id with location set")

    data = await weather_service.get_weather(lat, lon)
    return data


@router.get("/hotspot")
async def get_weather_hotspot(
    farm_id: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    force_refresh: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns genuine gridded regional weather data (temperature, rainfall, humidity, wind)
    and agronomic disease/pest risk indicators across an 11x11 km zone centered on the farm.
    Evaluates real pathogen thresholds and surfaces elevated risks to notifications.
    """
    from app.services.weather_hotspot_service import weather_hotspot_service

    if latitude is not None and lat is None:
        lat = latitude
    if longitude is not None and lon is None:
        lon = longitude

    crop_type = None
    farm_name = None

    if farm_id:
        farm = db.query(Farm).filter(Farm.id == farm_id).first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")
        if not farm.latitude or not farm.longitude:
            raise HTTPException(status_code=400, detail="Farm location not set. Please set farm coordinates first.")
        lat, lon = farm.latitude, farm.longitude
        crop_type = farm.crop_type
        farm_name = farm.name
    elif not lat or not lon:
        # Default to user's first registered farm if available
        first_farm = db.query(Farm).filter(Farm.user_id == current_user.id).first()
        if first_farm and first_farm.latitude and first_farm.longitude:
            lat, lon = first_farm.latitude, first_farm.longitude
            farm_id = str(first_farm.id)
            crop_type = first_farm.crop_type
            farm_name = first_farm.name
        else:
            lat = 17.7265
            lon = 78.2916

    data = await weather_hotspot_service.get_regional_hotspot_data(
        lat=lat,
        lon=lon,
        farm_id=farm_id,
        crop_type=crop_type,
        farm_name=farm_name,
        user_id=str(current_user.id),
        db=db,
        force_refresh=force_refresh,
    )

    if not data.get("available"):
        raise HTTPException(status_code=503, detail=data.get("message", "Unable to load live weather data"))

    return data


@router.post("/evaluate-risk")
async def evaluate_weather_risk(
    farm_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Explicitly forces fresh meteorological fetch and evaluates agronomic disease risk
    to dispatch immediate push & in-app alerts if thresholds are exceeded.
    """
    from app.services.weather_hotspot_service import weather_hotspot_service

    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if not farm.latitude or not farm.longitude:
        raise HTTPException(status_code=400, detail="Farm coordinates not defined")

    data = await weather_hotspot_service.get_regional_hotspot_data(
        lat=farm.latitude,
        lon=farm.longitude,
        farm_id=str(farm.id),
        crop_type=farm.crop_type,
        farm_name=farm.name,
        user_id=str(current_user.id),
        db=db,
        force_refresh=True,
    )

    return {
        "status": "success",
        "farm_id": str(farm.id),
        "farm_name": farm.name,
        "disease_risk": data.get("center_readings", {}).get("disease_risk"),
        "alert_dispatched": data.get("alert_dispatched", False),
    }

