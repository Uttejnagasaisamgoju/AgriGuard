"""
Test Role-Scoped Context and Claude API Preparation in AgriGuard
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.session import SessionLocal, create_tables
from app.models.user import User, UserRole
from app.services.ai_chat_service import ai_chat_service, build_role_context, build_system_prompt

def test_role_scoped_contexts():
    db = SessionLocal()
    create_tables()

    # 1. Test Farmer Context
    farmer = db.query(User).filter(User.role == UserRole.FARMER).first()
    if not farmer:
        farmer = User(name="Ramesh Kumar", role=UserRole.FARMER, email="ramesh@test.com")
        db.add(farmer)
        db.commit()

    farmer_ctx = build_role_context(db, farmer)
    assert farmer_ctx["user_role"] == "FARMER"
    assert "active_farm" in farmer_ctx
    assert "recent_detections" in farmer_ctx
    # Ensure officer-specific keys are NOT present
    assert "assigned_cases" not in farmer_ctx
    assert "active_consultations" not in farmer_ctx
    print("[PASS] Farmer Context strictly scoped to farmer records")

    # 2. Test Officer Context
    officer = db.query(User).filter(User.role == UserRole.OFFICER).first()
    if not officer:
        officer = User(name="Officer Patil", role=UserRole.OFFICER, email="patil@test.com")
        db.add(officer)
        db.commit()

    officer_ctx = build_role_context(db, officer)
    assert officer_ctx["user_role"] == "OFFICER"
    assert "assigned_cases" in officer_ctx
    assert "case_count" in officer_ctx
    # Ensure farmer-specific farm management keys or expert keys are NOT present
    assert "active_consultations" not in officer_ctx
    print("[PASS] Officer Context strictly scoped to assigned cases and officer duties")

    # 3. Test Expert Context
    expert = db.query(User).filter(User.role == UserRole.EXPERT).first()
    if not expert:
        expert = User(name="Dr. Swaminathan", role=UserRole.EXPERT, email="swami@test.com")
        db.add(expert)
        db.commit()

    expert_ctx = build_role_context(db, expert)
    assert expert_ctx["user_role"] == "EXPERT"
    assert "active_consultations" in expert_ctx
    # Ensure officer cases not assigned to them are NOT present
    assert "assigned_cases" not in expert_ctx
    print("[PASS] Expert Context strictly scoped to expert consultations")

    # 4. Test System Prompt Construction
    sources = [{"title": "ICAR Rice Blast Management", "source": "ICAR 2024", "snippet": "Tricyclazole 75% WP @ 0.6 g/L"}]
    farmer_prompt = build_system_prompt(farmer, farmer_ctx, sources)
    assert "AgriGuard AI Assistant helping a farmer" in farmer_prompt
    assert "AUTHORIZED USER DATA" in farmer_prompt
    assert "DO NOT fabricate" in farmer_prompt
    print("[PASS] Farmer Claude System Prompt safely constructed with boundaries and anti-injection")

    officer_prompt = build_system_prompt(officer, officer_ctx, sources)
    assert "helping Agricultural Officer" in officer_prompt
    assert "assigned cases" in officer_prompt
    print("[PASS] Officer Claude System Prompt safely constructed with compliance instructions")

    expert_prompt = build_system_prompt(expert, expert_ctx, sources)
    assert "helping Agricultural Expert" in expert_prompt
    assert "active consultations" in expert_prompt
    print("[PASS] Expert Claude System Prompt safely constructed with high-tier agronomy guidance")

    # 5. Test Chat Service Response Generation for all 3 roles
    for u in [farmer, officer, expert]:
        res = ai_chat_service.generate_response(
            db=db,
            user=u,
            query="What should be done for leaf spots?",
        )
        assert "response" in res
        assert "conversation_id" in res
        assert "sources" in res
        assert "suggested_questions" in res
        # Ensure confidence is None (no fake confidence returned)
        assert res.get("confidence") is None
        print(f"[PASS] generate_response succeeded for role {u.role.value} (model: {res.get('model_version')})")

    db.close()
    print("\n=== ALL ROLE-SCOPED & PROMPT TESTS PASSED ===")

if __name__ == "__main__":
    test_role_scoped_contexts()
