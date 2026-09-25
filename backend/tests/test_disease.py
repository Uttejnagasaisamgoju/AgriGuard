import pytest


def test_disease_library(client):
    # 1. Get all diseases from seeded library
    res = client.get("/api/diseases")
    assert res.status_code == 200
    data = res.json()
    assert "diseases" in data
    diseases = data["diseases"]
    assert len(diseases) >= 5

    # 2. Filter by crop "Rice"
    res_rice = client.get("/api/diseases?crop=Rice")
    assert res_rice.status_code == 200
    rice_diseases = res_rice.json()["diseases"]
    assert any("Brown Spot" in d["name"] or "Blight" in d["name"] for d in rice_diseases)

    # 3. Search for "Blight"
    res_search = client.get("/api/diseases?search=Blight")
    assert res_search.status_code == 200
    blight_results = res_search.json()["diseases"]
    assert len(blight_results) >= 1

    # 4. Get specific disease detail
    disease_id = diseases[0]["id"]
    res_detail = client.get(f"/api/diseases/{disease_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert "name" in detail
    assert "symptoms" in detail
    assert "management" in detail

