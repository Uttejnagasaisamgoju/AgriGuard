import pytest


def test_officer_dashboard(client):
    # 1. Login as officer
    login_res = client.post("/api/auth/login", json={
        "email": "officer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Access dashboard
    res = client.get("/api/officer/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "farmers_monitored" in data or "total_farmers" in data or "metrics" in data or "stats" in data or "total_cases" in data


def test_farmer_denied_officer_dashboard(client):
    # Login as farmer
    login_res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Should be forbidden 403
    res = client.get("/api/officer/dashboard", headers=headers)
    assert res.status_code == 403
