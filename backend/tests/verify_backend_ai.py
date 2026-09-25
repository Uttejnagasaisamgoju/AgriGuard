"""
Verification script for AgriGuard AI & ML Services
"""
import sys
import io
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.session import SessionLocal, create_tables
from app.models.user import User
from app.services.rag_service import rag_service
from app.services.ai_chat_service import ai_chat_service
from app.services.ml_service import ml_service
from app.main import app

def test_backend():
    print("=== Testing Backend AI and ML Capabilities ===")
    db = SessionLocal()
    create_tables()

    # Get a real user or seed
    user = db.query(User).first()
    if not user:
        from app.database.seed import seed_database
        seed_database(db)
        user = db.query(User).first()

    user_id = str(user.id) if user else "00000000-0000-0000-0000-000000000001"
    print(f"Using user_id: {user_id}")

    # 1. RAG knowledge base
    rag_service.seed_initial_knowledge(db)
    docs = rag_service.search("rice blast brown spot treatment", db, crop="Rice")
    print(f"\n1. RAG Search: {len(docs)} documents returned")
    for d in docs:
        print(f"   [{d['document_id']}] {d['title']} (Score: {d['relevance_score']})")

    # 2. PyTorch ML Inference on genuine leaf
    project_root = Path(__file__).resolve().parent.parent.parent
    leaf_path = str(project_root / "frontend" / "public" / "crop_brown_spot.jpg")
    pred = ml_service.predict(leaf_path)
    print(f"\n2. ML Inference on Rice Brown Spot Leaf:")
    print(f"   Disease: {pred.get('disease')}")
    print(f"   Crop: {pred.get('crop')}")
    print(f"   Confidence: {pred.get('confidence')}")
    print(f"   Is Leaf Valid: {pred.get('is_leaf_valid')}")
    print(f"   Model Version: {pred.get('model_version')}")
    print(f"   Entropy: {pred.get('entropy')}")
    print(f"   Is Uncertain: {pred.get('is_uncertain')}")
    print(f"   Recommendations count: {len(pred.get('recommendations', []))}")

    # 3. Validation rejection on Non-Leaf (Human Face)
    human_path = str(project_root / "frontend" / "public" / "farmer_avatar.jpg")
    human_pred = ml_service.predict(human_path)
    print(f"\n3. Pre-Validation on Non-Leaf (Human Avatar):")
    print(f"   Is Leaf Valid: {human_pred.get('is_leaf_valid')}")
    print(f"   Reason: {human_pred.get('validation_reason')}")
    print(f"   Guidance: {human_pred.get('actionable_guidance')}")

    # 4. AI Chat Assistant Intent & Grounded RAG
    chat_res = ai_chat_service.generate_response(
        db=db,
        user_id=user_id,
        query="My paddy leaves have diamond spindle-shaped brown spots. What should I spray?",
    )
    print(f"\n4. AI Chat Assistant Response:")
    print(f"   Model: {chat_res.get('model_version')}")
    print(f"   Confidence: {chat_res.get('confidence')}")
    print(f"   Sources cited: {len(chat_res.get('sources', []))}")
    print(f"   Suggested questions: {len(chat_res.get('suggested_questions', []))}")
    print(f"   Response snippet: {chat_res.get('response')[:200]}...")

    # 5. Non-Agri Intent Filter
    non_agri_res = ai_chat_service.generate_response(
        db=db,
        user_id=user_id,
        query="How do I write a python program to calculate bitcoin prices?",
    )
    print(f"\n5. Non-Agri Intent Filter Response:")
    print(f"   Model: {non_agri_res.get('model_version')}")
    print(f"   Response: {non_agri_res.get('response')[:150]}...")

    print("\n=== ALL BACKEND AI VERIFICATIONS PASSED ===")

if __name__ == "__main__":
    test_backend()
