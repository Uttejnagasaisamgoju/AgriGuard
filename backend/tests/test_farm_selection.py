import pytest
from app.models.farm import Farm


def test_farm_selection_and_satellite_telemetry(client):
    # 1. Login as farmer
    login_res = client.post("/api/auth/login", json={
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    assert login_res.status_code == 200, "Login failed"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. List farms
    list_res = client.get("/api/farms", headers=headers)
    assert list_res.status_code == 200
    farms = list_res.json()["farms"]
    assert len(farms) >= 1, "At least one farm should exist from seed data"

    first_farm = farms[0]
    farm_id = first_farm["id"]

    # 3. Verify satellite endpoint works for this farm
    sat_res = client.get(f"/api/farms/{farm_id}/satellite", headers=headers)
    assert sat_res.status_code == 200
    sat_data = sat_res.json()
    assert "ndvi_mean" in sat_data or "ndvi" in sat_data

    # 4. Create a second farm to test multi-farm scenario
    new_farm_payload = {
        "name": "East Meadow Paddy",
        "crop_type": "Wheat",
        "crop_variety": "HD 2967",
        "area_hectares": 3.2,
        "latitude": 18.1124,
        "longitude": 79.0125,
        "district": "Karimnagar",
        "state": "Telangana",
        "boundary_geojson": {
            "type": "Polygon",
            "coordinates": [[
                [79.0120, 18.1120],
                [79.0130, 18.1120],
                [79.0130, 18.1130],
                [79.0120, 18.1130],
                [79.0120, 18.1120]
            ]]
        }
    }
    create_res = client.post("/api/farms", json=new_farm_payload, headers=headers)
    assert create_res.status_code in [200, 201]
    created_farm = create_res.json()["farm"]
    created_farm_id = created_farm["id"]

    # 5. Verify satellite telemetry for second farm
    sat_res_2 = client.get(f"/api/farms/{created_farm_id}/satellite", headers=headers)
    assert sat_res_2.status_code == 200
    sat_data_2 = sat_res_2.json()
    assert "ndvi_mean" in sat_data_2 or "ndvi" in sat_data_2

    # 6. Delete the temporary test farm to restore clean state
    del_res = client.delete(f"/api/farms/{created_farm_id}", headers=headers)
    assert del_res.status_code == 200
