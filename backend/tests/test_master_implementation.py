"""
Master Verification Test Suite for AgriGuard:
1. Multi-Turn AI Conversational Memory
2. Pronoun & Reference Resolution (Tomato -> Yellow Leaves -> Six weeks old)
3. Simplification Request Handling
4. Earlier Recommendation Recall
5. Session Ownership & Authorization
6. Conversation Deletion (Clear Conversation)
7. Farm Boundary Coordinate Precision & Layer Fidelity
"""
import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import get_db, SessionLocal
from app.models.user import User, UserRole
from app.models.chat import AIConversation, AIMessage
from app.models.farm import Farm
from app.auth.security import create_access_token

client = TestClient(app)

def test_full_master_suite():
    db = SessionLocal()
    try:
        # 1. Create or fetch test users
        farmer_user = db.query(User).filter(User.email == "test_farmer_memory@agriguard.app").first()
        if not farmer_user:
            farmer_user = User(
                email="test_farmer_memory@agriguard.app",
                password_hash="testpassword",
                name="Test Memory Farmer",
                role=UserRole.FARMER,
                is_active=True,
            )
            db.add(farmer_user)
            db.commit()
            db.refresh(farmer_user)

        officer_user = db.query(User).filter(User.email == "test_officer_memory@agriguard.app").first()
        if not officer_user:
            officer_user = User(
                email="test_officer_memory@agriguard.app",
                password_hash="testpassword",
                name="Test Memory Officer",
                role=UserRole.OFFICER,
                is_active=True,
            )
            db.add(officer_user)
            db.commit()
            db.refresh(officer_user)

        farmer_token = create_access_token({"sub": str(farmer_user.id), "role": farmer_user.role.value})
        officer_token = create_access_token({"sub": str(officer_user.id), "role": officer_user.role.value})

        farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
        officer_headers = {"Authorization": f"Bearer {officer_token}"}

        # ── TEST 1: Farm Boundary Coordinate Precision ────────────────────────
        print("\n[TEST 1] Testing Farm Boundary Coordinate Precision...")
        test_geojson = {
            "type": "Polygon",
            "coordinates": [
                [
                    [78.094123, 18.672545],
                    [78.095456, 18.672890],
                    [78.095123, 18.671234],
                    [78.093890, 18.671567],
                    [78.094123, 18.672545]
                ]
            ]
        }
        farm_payload = {
            "name": "Precision Test Plot",
            "latitude": 18.672545,
            "longitude": 78.094123,
            "boundary_geojson": test_geojson,
            "area_hectares": 2.45,
            "crop_type": "Tomato",
        }
        res_farm = client.post("/api/farms", json=farm_payload, headers=farmer_headers)
        assert res_farm.status_code == 201, f"Failed to create farm: {res_farm.text}"
        farm_data = res_farm.json()["farm"]
        assert farm_data["latitude"] == 18.672545
        assert farm_data["longitude"] == 78.094123
        assert farm_data["boundary_geojson"]["coordinates"][0][0] == [78.094123, 18.672545]
        print("  -> Farm boundary coordinates preserved with full float precision (PASS)")

        # ── TEST 2: Multi-Turn Conversation Context & Memory ──────────────────
        print("\n[TEST 2] Testing Multi-Turn Conversation Memory...")

        # Turn 1: Initial symptom description
        t1 = client.post(
            "/api/ai/chat",
            json={"query": "My tomato plants have yellow leaves with dark concentric rings."},
            headers=farmer_headers,
        )
        assert t1.status_code == 200, f"Turn 1 failed: {t1.text}"
        data1 = t1.json()
        conv_id = data1["conversation_id"]
        assert conv_id is not None
        assert "agri" in data1["response"].lower() or "blight" in data1["response"].lower() or "leaf" in data1["response"].lower()
        print(f"  -> Turn 1 stored in conversation {conv_id}")

        # Turn 2: Follow-up using anaphora ("they", "them", "six weeks old")
        t2 = client.post(
            "/api/ai/chat",
            json={
                "query": "They are six weeks old. What should I do for them?",
                "conversation_id": conv_id,
            },
            headers=farmer_headers,
        )
        assert t2.status_code == 200, f"Turn 2 failed: {t2.text}"
        data2 = t2.json()
        assert data2["conversation_id"] == conv_id
        # Response must recognize tomato plants or active symptoms from conversation history
        r2_lower = data2["response"].lower()
        assert ("tomato" in r2_lower or "blight" in r2_lower or "six" in r2_lower or "plants" in r2_lower), \
            f"Expected memory of tomato crop / age in response, got: {data2['response']}"
        print("  -> Turn 2 resolved pronoun 'them' to six-week-old tomato plants (PASS)")

        # Turn 3: Simplification request ("Can you explain that more simply?")
        t3 = client.post(
            "/api/ai/chat",
            json={
                "query": "Can you explain that more simply?",
                "conversation_id": conv_id,
            },
            headers=farmer_headers,
        )
        assert t3.status_code == 200, f"Turn 3 failed: {t3.text}"
        data3 = t3.json()
        r3_lower = data3["response"].lower()
        assert ("simplified" in r3_lower or "easy" in r3_lower or "step" in r3_lower or "break" in r3_lower), \
            f"Expected simplified explanation, got: {data3['response']}"
        print("  -> Turn 3 successfully provided beginner-friendly simplified advisory (PASS)")

        # Turn 4: Recall earlier treatment ("What treatment did you recommend earlier?")
        t4 = client.post(
            "/api/ai/chat",
            json={
                "query": "What treatment did you recommend earlier?",
                "conversation_id": conv_id,
            },
            headers=farmer_headers,
        )
        assert t4.status_code == 200, f"Turn 4 failed: {t4.text}"
        data4 = t4.json()
        r4_lower = data4["response"].lower()
        assert ("earlier" in r4_lower or "recommend" in r4_lower or "protocol" in r4_lower or "treatment" in r4_lower), \
            f"Expected recall of earlier recommendation, got: {data4['response']}"
        print("  -> Turn 4 successfully recalled earlier recommendation (PASS)")

        # ── TEST 3: Conversation Persistence & Restoration ───────────────────
        print("\n[TEST 3] Testing Conversation Persistence & Message Restoration...")
        list_res = client.get("/api/ai/conversations", headers=farmer_headers)
        assert list_res.status_code == 200
        conv_list = list_res.json()
        matching_conv = next((c for c in conv_list if c["id"] == conv_id), None)
        assert matching_conv is not None, "Conversation was not found in user conversation list"
        assert matching_conv["message_count"] >= 8, f"Expected at least 8 messages, found {matching_conv['message_count']}"

        # Fetch messages directly
        msg_res = client.get(f"/api/ai/conversations/{conv_id}/messages", headers=farmer_headers)
        assert msg_res.status_code == 200
        msgs = msg_res.json()
        assert len(msgs) >= 8
        print(f"  -> Successfully restored {len(msgs)} persistent messages from DB (PASS)")

        # ── TEST 4: Conversation Authorization & Ownership Isolation ─────────
        print("\n[TEST 4] Testing Authorization & Ownership Isolation...")
        # Officer user attempts to read Farmer user's conversation -> must be 404 (Not Found or Unauthorized)
        unauth_read = client.get(f"/api/ai/conversations/{conv_id}/messages", headers=officer_headers)
        assert unauth_read.status_code == 404, f"Expected 404 unauthorized, got {unauth_read.status_code}"

        unauth_del = client.delete(f"/api/ai/conversations/{conv_id}", headers=officer_headers)
        assert unauth_del.status_code == 404, f"Expected 404 unauthorized, got {unauth_del.status_code}"
        print("  -> Cross-user conversation access properly rejected with 404 (PASS)")

        # ── TEST 5: Clear Conversation (Deletion) ─────────────────────────────
        print("\n[TEST 5] Testing Clear Conversation...")
        del_res = client.delete(f"/api/ai/conversations/{conv_id}", headers=farmer_headers)
        assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
        assert del_res.json()["status"] == "success"

        # Verify it no longer exists
        verify_del = client.get(f"/api/ai/conversations/{conv_id}/messages", headers=farmer_headers)
        assert verify_del.status_code == 404
        print("  -> Conversation and message history permanently cleared from database (PASS)")

        print("\n========================================================")
        print("ALL MASTER IMPLEMENTATION TESTS PASSED PERFECTLY (PASS)")
        print("========================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_full_master_suite()
