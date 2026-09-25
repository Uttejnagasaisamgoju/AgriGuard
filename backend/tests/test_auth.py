import pytest


def test_register_and_login(client):
    # 1. Register new farmer
    reg_payload = {
        "name": "Ravi Teja",
        "email": "ravi.teja@example.com",
        "password": "StrongPassword123!",
        "role": "FARMER"
    }
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code in [200, 201]
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "ravi.teja@example.com"

    # 2. Login with registered credentials
    login_payload = {
        "email": "ravi.teja@example.com",
        "password": "StrongPassword123!"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token_data = login_res.json()
    access_token = token_data["access_token"]
    assert access_token

    # 3. Get profile with token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Ravi Teja"


def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={
        "email": "ravi.teja@example.com",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401


def test_login_seeded_farmer(client):
    res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "FARMER"

