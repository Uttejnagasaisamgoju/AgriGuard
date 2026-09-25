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
