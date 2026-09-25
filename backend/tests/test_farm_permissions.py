"""
AgriGuard Role-Based Farm Creation Permission Tests.
Verifies that:
- Farmers are authorized to create farms (201 Created).
- Officers are strictly rejected from creating farms (403 Forbidden).
- Experts are strictly rejected from creating farms (403 Forbidden).
- Officers and Experts retain legitimate read/view access to authorized farms.
"""
import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath("backend"))
from app.main import app

client = TestClient(app)


def get_token(email: str, password: str = "Demo@1234") -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_farmer_can_create_farm():
    token = get_token("farmer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    farm_payload = {
        "name": "Automated Test Green Field",
        "description": "Validation parcel for role authorization",
        "crop_type": "Tomato",
        "crop_variety": "Roma",
        "district": "Medak",
        "state": "Telangana",
        "soil_type": "loamy",
        "irrigation_type": "drip",
        "latitude": 17.5501,
        "longitude": 78.3301,
        "area_hectares": 2.5,
        "boundary_geojson": {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.330, 17.550],
                    [78.335, 17.550],
                    [78.335, 17.555],
                    [78.330, 17.555],
                    [78.330, 17.550],
                ]
            ],
        },
    }

    res = client.post("/api/farms", json=farm_payload, headers=headers)
    assert res.status_code == 201, f"Expected 201 for Farmer, got {res.status_code}: {res.text}"
    data = res.json()
    assert "farm" in data
    assert data["farm"]["name"] == "Automated Test Green Field"
    farm_id = data["farm"]["id"]

    # Verify farmer can read their farm
    get_res = client.get(f"/api/farms/{farm_id}", headers=headers)
    assert get_res.status_code == 200


def test_officer_cannot_create_farm():
    token = get_token("officer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    farm_payload = {
        "name": "Unauthorized Officer Farm Attempt",
        "crop_type": "Rice",
        "latitude": 17.55,
        "longitude": 78.33,
        "area_hectares": 1.2,
    }

    # Direct API call must be rejected with HTTP 403 Forbidden
    res = client.post("/api/farms", json=farm_payload, headers=headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for Officer, got {res.status_code}: {res.text}"
    assert "not authorized to create or register farms" in res.json().get("detail", "").lower()


def test_expert_cannot_create_farm():
    token = get_token("expert@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    farm_payload = {
        "name": "Unauthorized Expert Farm Attempt",
        "crop_type": "Cotton",
        "latitude": 17.55,
        "longitude": 78.33,
        "area_hectares": 3.0,
    }

    # Direct API call must be rejected with HTTP 403 Forbidden
    res = client.post("/api/farms", json=farm_payload, headers=headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for Expert, got {res.status_code}: {res.text}"
    assert "not authorized to create or register farms" in res.json().get("detail", "").lower()


def test_officer_and_expert_retain_farm_viewing():
    # Verify Officer can list farms
    off_token = get_token("officer@demo.agriguard.app")
    off_res = client.get("/api/farms", headers={"Authorization": f"Bearer {off_token}"})
    assert off_res.status_code == 200
    assert "farms" in off_res.json()

    # Verify Expert can list farms
    exp_token = get_token("expert@demo.agriguard.app")
    exp_res = client.get("/api/farms", headers={"Authorization": f"Bearer {exp_token}"})
    assert exp_res.status_code == 200
    assert "farms" in exp_res.json()


if __name__ == "__main__":
    print("Running farm permissions verification...")
    test_farmer_can_create_farm()
    print("PASS: Farmer can create farm (201 Created)")
    test_officer_cannot_create_farm()
    print("PASS: Officer cannot create farm (403 Forbidden)")
    test_expert_cannot_create_farm()
    print("PASS: Expert cannot create farm (403 Forbidden)")
    test_officer_and_expert_retain_farm_viewing()
    print("PASS: Officer and Expert retain farm viewing (200 OK)")
    print("ALL FARM PERMISSION TESTS PASSED!")
