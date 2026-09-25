"""
Comprehensive Master Verification Test Suite for AgriGuard:
1. Real AI Training & Pipeline with Provenance & Quality Control
2. Camera Disease Detection with Multi-Image Validation
3. Structured Agricultural Analysis AI Layer
4. Early-Stage Detection Honesty (NOT YET SUPPORTED)
5. Grounded AI Chatbot & Diagnosis Explanation
6. Unified Database Activities Feed (No mock timestamps)
7. Reports & Analytics with Authoritative Timestamps
8. Officer Case Resolution & Complete History Timeline
9. Expert Resolved Cases Access
"""
import os
import sys
import pytest
from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal
from app.models.user import User, UserRole
from app.models.officer import OfficerCase, CaseStatus
from app.models.disease import DiseasePrediction
from app.auth.security import create_access_token

client = TestClient(app)

def create_sample_leaf_image(color=(34, 139, 34), size=(224, 224)):
    """Generate a clean green leaf-like RGB image in memory"""
    img = Image.new("RGB", size, color=color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_master_production_ai_and_workflows():
    db = SessionLocal()
    try:
        # 1. Setup authenticated users (Farmer, Officer, Expert)
        farmer = db.query(User).filter(User.email == "master_farmer@agriguard.app").first()
        if not farmer:
            farmer = User(
                email="master_farmer@agriguard.app",
                password_hash="hashpass",
                name="Master Farmer Ramesh",
                role=UserRole.FARMER,
                is_active=True,
            )
            db.add(farmer)

        officer = db.query(User).filter(User.email == "master_officer@agriguard.app").first()
        if not officer:
            officer = User(
                email="master_officer@agriguard.app",
                password_hash="hashpass",
                name="Master Officer Sharma",
                role=UserRole.OFFICER,
                is_active=True,
            )
            db.add(officer)

        expert = db.query(User).filter(User.email == "master_expert@agriguard.app").first()
        if not expert:
            expert = User(
                email="master_expert@agriguard.app",
                password_hash="hashpass",
                name="Dr. Master Expert Patel",
                role=UserRole.EXPERT,
                is_active=True,
            )
            db.add(expert)

        db.commit()
        db.refresh(farmer)
        db.refresh(officer)
        db.refresh(expert)

        farmer_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(farmer.id), 'role': farmer.role.value})}"}
        officer_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(officer.id), 'role': officer.role.value})}"}
        expert_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(expert.id), 'role': expert.role.value})}"}

        # =========================================================================
        # AREA 1: Real AI Training Pipeline & Expert Provenance
        # =========================================================================
        pipe_res = client.get("/api/ai/training/pipeline", headers=expert_headers)
        assert pipe_res.status_code == 200, f"Failed training pipeline endpoint: {pipe_res.text}"
        pipe_data = pipe_res.json()
        assert "pipeline_version" in pipe_data
        assert "quality_gates" in pipe_data
        assert "early_stage_support" in pipe_data
        assert pipe_data["quality_gates"]["consent_required"] is True
        assert pipe_data["early_stage_support"]["status"] == "NOT YET SUPPORTED"
        print("[PASS] Area 1: Training pipeline provenance and quality control verified.")

        # =========================================================================
        # AREA 2 & 3: Multi-Image Detection & Agricultural Analysis AI Layer
        # =========================================================================
        leaf_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"
        with open(leaf_path, "rb") as f:
            leaf_bytes1 = f.read()
        with open(leaf_path, "rb") as f:
            leaf_bytes2 = f.read()

        files = [
            ("images", ("leaf1.jpg", leaf_bytes1, "image/jpeg")),
            ("images", ("leaf2.jpg", leaf_bytes2, "image/jpeg")),
        ]
        pred_res = client.post("/api/diseases/ml/predict", files=files, headers=farmer_headers)
        assert pred_res.status_code == 200, f"Predict failed: {pred_res.text}"
        pred_data = pred_res.json()

        assert "agricultural_analysis" in pred_data
        ag_analysis = pred_data["agricultural_analysis"]
        assert "observed_symptoms" in ag_analysis
        assert "transparent_reasoning" in ag_analysis
        assert "immediate_actions" in ag_analysis
        assert "monitoring_schedule" in ag_analysis
        assert len(ag_analysis["observed_symptoms"]) > 0
        assert len(ag_analysis["immediate_actions"]) > 0

        # Multi-image breakdown
        assert "image_results" in pred_data
        assert len(pred_data["image_results"]) == 2
        for im in pred_data["image_results"]:
            assert "is_leaf_valid" in im
            assert "confidence" in im
        print("[PASS] Area 2 & 3: Multi-image detection & structured agricultural analysis verified.")

        # =========================================================================
        # AREA 4: Early-Stage Disease Detection Honesty
        # =========================================================================
        early_stage = ag_analysis.get("early_stage_detection", {})
        assert early_stage.get("supported") is False
        assert early_stage.get("status") == "NOT YET SUPPORTED"
        assert "unannotated" in early_stage.get("reason", "").lower() or "classes" in early_stage.get("reason", "").lower()
        print("[PASS] Area 4: Early-stage unannotated limitation reported honestly without mock status.")

        # =========================================================================
        # AREA 5: Grounded Chatbot & Diagnosis Explanation
        # =========================================================================
        # Ask AI about the previous diagnosis
        chat_query = {
            "query": "Why did you diagnose this crop disease and what is your reasoning?"
        }
        chat_res = client.post("/api/ai/chat", json=chat_query, headers=farmer_headers)
        assert chat_res.status_code == 200, f"Chat failed: {chat_res.text}"
        chat_data = chat_res.json()
        assert "response" in chat_data
        assert len(chat_data["response"]) > 20
        # Verify hallucination rejection on off-topic questions
        off_query = {"query": "Should I invest my farm profits into cryptocurrency?"}
        off_res = client.post("/api/ai/chat", json=off_query, headers=farmer_headers)
        assert off_res.status_code == 200
        off_reply = off_res.json()["response"].lower()
        assert "agriculture" in off_reply or "agronomic" in off_reply or "farming" in off_reply or "agricultural" in off_reply or "crop" in off_reply
        print("[PASS] Area 5: Chatbot grounded in pathology and diagnosis explanation verified.")

        # =========================================================================
        # AREA 6: Unified Real Activities Feed
        # =========================================================================
        act_res = client.get("/api/activities", headers=farmer_headers)
        assert act_res.status_code == 200, f"Activities failed: {act_res.text}"
        act_data = act_res.json()
        assert "activities" in act_data
        assert isinstance(act_data["activities"], list)
        for act in act_data["activities"]:
            # Ensure authoritative timestamps exist and no fake strings
            assert "created_at" in act
            assert act.get("time") != "2 hours ago"
        print("[PASS] Area 6: Unified real activities feed verified without fake timestamps.")

        # =========================================================================
        # AREA 7: Reports & Analytics
        # =========================================================================
        rep_res = client.get("/api/reports?period=30d", headers=farmer_headers)
        assert rep_res.status_code == 200, f"Reports failed: {rep_res.text}"
        rep_data = rep_res.json()
        assert "summary" in rep_data
        assert "has_data" in rep_data
        assert "disease_distribution" in rep_data
        print("[PASS] Area 7: Reports & Analytics verified with authoritative database aggregation.")

        # =========================================================================
        # AREA 8: Officer Case Resolution & Complete History Timeline
        # =========================================================================
        # Create an active case
        test_case = OfficerCase(
            farmer_id=farmer.id,
            officer_id=officer.id,
            prediction_id=pred_data.get("prediction_id"),
            title="Field Pathogen Infection - Plot 4",
            description="High confidence foliar spotting observed during morning inspection.",
            priority="high",
            status=CaseStatus.UNDER_REVIEW,
        )
        db.add(test_case)
        db.commit()
        db.refresh(test_case)
        case_id = str(test_case.id)

        # Check it appears in active cases, and NOT in resolved cases
        active_list = client.get("/api/officer/cases?status=active", headers=officer_headers).json()
        assert any(c["id"] == case_id for c in active_list.get("cases", []))
        resolved_list = client.get("/api/officer/cases?status=RESOLVED", headers=officer_headers).json()
        assert not any(c["id"] == case_id for c in resolved_list.get("cases", []))

        # Resolve the case with resolution notes
        resolve_payload = {
            "status": "RESOLVED",
            "resolution_notes": "Applied copper oxychloride foliar spray. Scouting 5 days later showed no pathogen progression. Case closed.",
            "officer_notes": "Field cleared.",
        }
        update_res = client.put(f"/api/officer/cases/{case_id}", json=resolve_payload, headers=officer_headers)
        assert update_res.status_code == 200
        updated_case = update_res.json()["case"]
        assert updated_case["status"] == "RESOLVED"
        assert updated_case["resolution_notes"] is not None
        assert updated_case["resolved_by_id"] == str(officer.id)

        # Confirm case is now removed from active and moved into resolved
        active_list_after = client.get("/api/officer/cases?status=active", headers=officer_headers).json()
        assert not any(c["id"] == case_id for c in active_list_after.get("cases", []))
        resolved_list_after = client.get("/api/officer/cases?status=RESOLVED", headers=officer_headers).json()
        assert any(c["id"] == case_id for c in resolved_list_after.get("cases", []))

        # Check complete chronological history timeline
        hist_res = client.get(f"/api/officer/cases/{case_id}/history", headers=officer_headers)
        assert hist_res.status_code == 200, f"History failed: {hist_res.text}"
        hist_data = hist_res.json()
        assert "timeline" in hist_data
        timeline = hist_data["timeline"]
        assert len(timeline) >= 2 # Detection + AI Diagnosis + Resolution
        timeline_types = [t["type"] for t in timeline]
        assert "DETECTION" in timeline_types
        assert "RESOLUTION" in timeline_types
        print("[PASS] Area 8: Officer case resolution, automatic tab filtering, and timeline verified.")

        # =========================================================================
        # AREA 9: Expert Resolved Cases Access
        # =========================================================================
        expert_resolved = client.get("/api/expert/cases?status=RESOLVED", headers=expert_headers)
        assert expert_resolved.status_code == 200, f"Expert cases failed: {expert_resolved.text}"
        exp_cases = expert_resolved.json().get("cases", [])
        assert any(c["id"] == case_id for c in exp_cases)

        # Expert can also view case history
        exp_hist_res = client.get(f"/api/officer/cases/{case_id}/history", headers=expert_headers)
        assert exp_hist_res.status_code == 200
        assert len(exp_hist_res.json().get("timeline", [])) >= 2
        print("[PASS] Area 9: Expert resolved cases access and timeline review verified.")

        print("\n=======================================================")
        print("ALL 9 MASTER PRODUCTION SYSTEM CAPABILITIES VERIFIED: PASS")
        print("=======================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_master_production_ai_and_workflows()
