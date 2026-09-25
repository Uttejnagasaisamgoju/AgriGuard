import pytest


def test_farm_crud(client):
    # 1. Login as demo farmer
    login_res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })

    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create farm
    farm_data = {
        "name": "Green Valley Farm",
        "crop_type": "Rice",
        "crop_variety": "Basmati 370",
        "area_hectares": 2.4,
        "latitude": 17.7265,
        "longitude": 78.2916,
        "village": "Narsapur",
        "district": "Medak",
        "state": "Telangana"
    }
    create_res = client.post("/api/farms", json=farm_data, headers=headers)
    assert create_res.status_code in [200, 201]
    farm = create_res.json()["farm"]
    farm_id = farm["id"]
    assert farm["name"] == "Green Valley Farm"
    assert farm["area_hectares"] == 2.4

    # 3. List farms
    list_res = client.get("/api/farms", headers=headers)
    assert list_res.status_code == 200
    farms = list_res.json()["farms"]
    assert len(farms) >= 1

    # 4. Get farm by ID
    get_res = client.get(f"/api/farms/{farm_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["crop_type"] == "Rice"


    # 5. Update farm
    update_res = client.put(f"/api/farms/{farm_id}", json={"description": "High yield rice field"}, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["farm"]["description"] == "High yield rice field"

