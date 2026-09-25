"""Real weather service using OpenWeatherMap API"""
import httpx
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"
OPENWEATHER_ONECALL = "https://api.openweathermap.org/data/3.0/onecall"

# Simple in-memory cache (replace with Redis in production)
_weather_cache: Dict[str, dict] = {}
CACHE_TTL_SECONDS = 1800  # 30 minutes


WMO_WEATHER_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Slight Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
}

class WeatherService:
    def __init__(self):
        self.api_key = settings.OPENWEATHER_API_KEY
        self.is_configured = bool(self.api_key and self.api_key != "demo")

    async def get_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        cache_key = f"{lat:.4f},{lon:.4f}"
        if cache_key in _weather_cache:
            cached = _weather_cache[cache_key]
            if (datetime.utcnow() - cached["cached_at"]).seconds < CACHE_TTL_SECONDS:
                return cached["data"]

        # If OpenWeather is configured, try it first
        if self.is_configured:
            try:
                result = await self._get_openweather(lat, lon)
                if result and result.get("available"):
                    _weather_cache[cache_key] = {"data": result, "cached_at": datetime.utcnow()}
                    return result
            except Exception as e:
                logger.warning(f"OpenWeather failed, falling back to Open-Meteo: {e}")

        # Open-Meteo legitimate open science meteorological service (no API key required)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                        "hourly": "precipitation_probability,temperature_2m",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    curr = data.get("current", {})
                    hourly = data.get("hourly", {})
                    code = curr.get("weather_code", 0)
                    condition_desc = WMO_WEATHER_CODES.get(code, "Partly Cloudy")
                    
                    # Compute rain probability from current hour
                    rain_prob = 0
                    probs = hourly.get("precipitation_probability", [])
                    if probs:
                        rain_prob = probs[0]

                    forecast_items = []
                    temps = hourly.get("temperature_2m", [])
                    times = hourly.get("time", [])
                    for i in range(min(5, len(times))):
                        forecast_items.append({
                            "temp": temps[i] if i < len(temps) else curr.get("temperature_2m"),
                            "description": condition_desc,
                            "rain": probs[i] if i < len(probs) else 0,
                            "dt_txt": times[i] if i < len(times) else "",
                        })

                    result = {
                        "available": True,
                        "provider": "Open-Meteo Scientific",
                        "location": f"Farm ({lat:.2f}N, {lon:.2f}E)",
                        "temperature": round(curr.get("temperature_2m", 25.0), 1),
                        "feels_like": round(curr.get("apparent_temperature", curr.get("temperature_2m", 25.0)), 1),
                        "humidity": curr.get("relative_humidity_2m", 60),
                        "wind_speed": round(curr.get("wind_speed_10m", 0), 1),
                        "rain_probability": rain_prob,
                        "precipitation": curr.get("precipitation", 0.0),
                        "weather_code": code,
                        "description": condition_desc,
                        "forecast": forecast_items,
                        "recorded_at": datetime.utcnow().isoformat(),
                    }
                    _weather_cache[cache_key] = {"data": result, "cached_at": datetime.utcnow()}
                    return result
        except Exception as e:
            logger.error(f"Open-Meteo weather fetch error: {e}")

        return {
            "error": "Weather data unavailable",
            "message": "Unable to contact live weather satellites for this coordinate. Please verify network.",
            "available": False,
        }

    async def _get_openweather(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{OPENWEATHER_BASE}/weather",
                    params={"lat": lat, "lon": lon, "appid": self.api_key, "units": "metric"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    forecast_data = await self._get_forecast(client, lat, lon)
                    return {
                        "available": True,
                        "provider": "OpenWeatherMap",
                        "location": data.get("name", f"Coordinates {lat:.2f}, {lon:.2f}"),
                        "country": data.get("sys", {}).get("country"),
                        "temperature": data.get("main", {}).get("temp"),
                        "feels_like": data.get("main", {}).get("feels_like"),
                        "humidity": data.get("main", {}).get("humidity"),
                        "pressure": data.get("main", {}).get("pressure"),
                        "wind_speed": data.get("wind", {}).get("speed"),
                        "description": data.get("weather", [{}])[0].get("description", "").title(),
                        "rain_probability": data.get("rain", {}).get("1h", 0),
                        "forecast": forecast_data,
                        "recorded_at": datetime.utcnow().isoformat(),
                    }
        except Exception:
            return None

    async def _get_forecast(self, client: httpx.AsyncClient, lat: float, lon: float) -> list:
        try:
            resp = await client.get(
                f"{OPENWEATHER_BASE}/forecast",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": self.api_key,
                    "units": "metric",
                    "cnt": 5,  # 5 data points (every 3 hours)
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {
                        "dt": item.get("dt"),
                        "temp": item.get("main", {}).get("temp"),
                        "description": item.get("weather", [{}])[0].get("description", "").title(),
                        "icon": item.get("weather", [{}])[0].get("icon"),
                        "rain": item.get("rain", {}).get("3h", 0),
                        "dt_txt": item.get("dt_txt"),
                    }
                    for item in data.get("list", [])
                ]
        except Exception:
            pass
        return []
