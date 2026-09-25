import pytest

def test_weather_endpoint_open_meteo(client):
    """Verify live weather API integration with authentication"""
    login_res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/weather?latitude=17.7265&longitude=78.2916", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data.get("available") is True
    assert "temperature" in data
    assert "humidity" in data
    assert "description" in data

def test_reports_endpoint(client):
    """Verify agricultural analytics endpoint with authentication"""
    login_res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/reports", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "disease_trend" in data
    assert "has_data" in data
