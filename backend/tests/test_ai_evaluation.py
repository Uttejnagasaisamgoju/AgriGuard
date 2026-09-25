"""
AgriGuard AI Assistant — 50-Question Agronomy Evaluation Suite
Evaluates AI Assistant performance across 7 essential agricultural categories:
1. Crop Cultivation & Agronomy
2. Plant Pathology & Symptom Analysis
3. Pest Management & IPM
4. Fertilizer & Soil Nutrition
5. Irrigation & Water Management
6. Organic & Sustainable Farming
7. Non-Agricultural Out-of-Domain Guardrail Rejection
"""
import sys
import io
import time
import json
from pathlib import Path
from typing import List, Dict, Any

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.session import SessionLocal, create_tables
from app.models.user import User
from app.services.ai_chat_service import ai_chat_service
from app.services.rag_service import rag_service

EVALUATION_QUESTIONS = [
    # Category 1: Crop Cultivation & Agronomy (7 questions)
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "What is the recommended sowing depth and spacing for hybrid maize?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "When should I transplant rice seedlings from the nursery to the main field?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "What are the optimal soil temperatures for wheat seed germination?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "How do I calculate plant population per acre for drip-irrigated tomatoes?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "What companion crops work best when intercropped with pigeonpea?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "How many days after sowing should I pinch the apical buds in chili peppers?"},
    {"category": "Crop Cultivation", "expected_in_domain": True, "query": "What are the best crop rotation sequences to break sugarcane root pest cycles?"},

    # Category 2: Plant Pathology & Symptom Analysis (8 questions)
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "My rice leaves have spindle-shaped lesions with grey centers. Is it blast?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "What causes concentric dark target-like rings on the lower leaves of tomato plants?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "How can I distinguish between early blight and late blight in potato fields?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "What chemical fungicide is most effective against cucumber downy mildew?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "Why are my rice leaf tips turning white and wavy with bacterial ooze?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "How do I control powdery mildew white talcum patches on squash leaves?"},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "My maize leaves show golden-brown pustules along both sides of the leaf blade."},
    {"category": "Plant Pathology", "expected_in_domain": True, "query": "What is the vector for tomato yellow leaf curl virus and how do I prevent spread?"},

    # Category 3: Pest Management & IPM (7 questions)
    {"category": "Pest Management", "expected_in_domain": True, "query": "How do I control Fall Armyworm larvae feeding deep inside the maize whorl?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "What are the best pheromone trap densities per acre for pink bollworm in cotton?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "How do I eradicate whiteflies without killing beneficial ladybird beetles?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "What biological parasitoid wasp is most effective against stem borers?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "How can I treat yellow sticky trap infestations of thrips in onion crops?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "What is the recommended dosage of Emamectin benzoate for diamondback moth in cabbage?"},
    {"category": "Pest Management", "expected_in_domain": True, "query": "How do I prevent root knot nematodes from stunting tomato roots?"},

    # Category 4: Fertilizer Guidance & Soil Nutrition (7 questions)
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "Why are the lower leaves of my paddy crop turning completely yellow while upper leaves stay green?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "What is the proper split application timing for urea in flooded rice?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "How do I rectify potassium deficiency causing brown scorched margins on corn leaves?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "What is the correct dosage of zinc sulphate per hectare for rice khaira disease?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "How does soil pH below 5.5 affect phosphorus availability to crop roots?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "What amendments should I apply to reclaim sodic soil with high exchangeable sodium?"},
    {"category": "Fertilizer & Nutrition", "expected_in_domain": True, "query": "What is the benefit of applying agricultural gypsum compared to dolomite lime?"},

    # Category 5: Irrigation & Water Management (7 questions)
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "What are the most critical growth stages of wheat where water stress causes major yield loss?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "How does Alternate Wetting and Drying (AWD) save irrigation water in rice cultivation?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "How do I calculate drip irrigation run time for 2 acres of vegetables in sandy loam soil?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "Why should I avoid overhead sprinkler irrigation on tomato and potato crops during humid weather?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "How can I protect vegetable roots from hypoxia following 48 hours of field waterlogging?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "What soil water tension reading on a tensiometer indicates it is time to irrigate maize?"},
    {"category": "Irrigation & Water", "expected_in_domain": True, "query": "How does plastic mulch conserve soil moisture and reduce weed evapotranspiration?"},

    # Category 6: Organic & Sustainable Methods (7 questions)
    {"category": "Organic Farming", "expected_in_domain": True, "query": "How do I prepare a 5 percent Neem Seed Kernel Extract (NSKE) spray at home?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "What is the standard recipe and fermentation duration for Jeevamrutha bio-fertilizer?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "How do I apply Trichoderma viride to enrich farm yard manure before field application?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "Why must entomopathogenic fungi like Beauveria bassiana be sprayed in the late afternoon?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "What green manure crop is best suited for fixing atmospheric nitrogen before paddy transplanting?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "Can wood ash be used as an organic source of potassium in vegetable gardens?"},
    {"category": "Organic Farming", "expected_in_domain": True, "query": "How does vermicompost improve soil cation exchange capacity and microbial diversity?"},

    # Category 7: Non-Agricultural Out-of-Domain Guardrails (7 questions)
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Can you write a python script to implement quicksort algorithm?"},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "What is the current price prediction for Bitcoin and Ethereum this month?"},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Who directed the latest Hollywood Oppenheimer movie and who won the oscars?"},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Give me the latest cricket match score between India and Australia."},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Can you explain how blockchain consensus algorithms work in cryptocurrency?"},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Write a React frontend component with TailwindCSS for a login form."},
    {"category": "Out-of-Domain Rejection", "expected_in_domain": False, "query": "Who is leading the presidential election polls right now?"},
]


def run_ai_evaluation_suite() -> Dict[str, Any]:
    print("=" * 70)
    print("AgriGuard AI Assistant — 50-Question Agronomy Evaluation Suite")
    print("=" * 70)

    db = SessionLocal()
    create_tables()
    rag_service.seed_initial_knowledge(db)

    user = db.query(User).first()
    user_id = str(user.id) if user else "00000000-0000-0000-0000-000000000001"

    category_results = {}
    total_evals = len(EVALUATION_QUESTIONS)
    passed_evals = 0
    latencies = []

    print(f"\nEvaluating {total_evals} test prompts across 7 domains...\n")

    for idx, item in enumerate(EVALUATION_QUESTIONS, 1):
        cat = item["category"]
        expected_in = item["expected_in_domain"]
        query = item["query"]

        if cat not in category_results:
            category_results[cat] = {"total": 0, "passed": 0, "latencies": []}

        category_results[cat]["total"] += 1

        t0 = time.time()
        res = ai_chat_service.generate_response(db=db, user_id=user_id, query=query)
        latency_ms = round((time.time() - t0) * 1000, 1)
        latencies.append(latency_ms)
        category_results[cat]["latencies"].append(latency_ms)

        resp_text = res.get("response", "")
        model_v = res.get("model_version", "")
        sources = res.get("sources", [])

        # Evaluation criteria:
        if expected_in:
            # Must NOT be rejected by domain filter, must provide agricultural guidance
            is_pass = (
                model_v != "AgriGuard-Domain-Filter"
                and len(resp_text) > 100
                and not resp_text.startswith("🌱 **AgriGuard AI Agriculture Assistant**\n\nI am specialized exclusively")
            )
        else:
            # Must BE rejected by domain filter and politely guide back to farming
            is_pass = (
                model_v == "AgriGuard-Domain-Filter"
                or "exclusively in" in resp_text
                or "cannot assist with" in resp_text
            )

        if is_pass:
            passed_evals += 1
            category_results[cat]["passed"] += 1
            status_icon = "PASS"
        else:
            status_icon = "FAIL"

        print(f"[{idx:02d}/{total_evals}] [{status_icon}] [{cat:22s}] ({latency_ms:5.1f}ms) {query[:45]}...")

    overall_accuracy = round((passed_evals / total_evals) * 100.0, 2)
    avg_latency = round(sum(latencies) / len(latencies), 1)

    print("\n" + "=" * 70)
    print("EVALUATION RESULTS BY CATEGORY:")
    print("=" * 70)
    for cat, data in category_results.items():
        cat_acc = round((data["passed"] / data["total"]) * 100.0, 1)
        cat_lat = round(sum(data["latencies"]) / len(data["latencies"]), 1)
        print(f"- {cat:32s}: {data['passed']}/{data['total']} passed ({cat_acc:5.1f}%) | Avg Latency: {cat_lat:5.1f}ms")

    print("-" * 70)
    print(f"OVERALL AI BENCHMARK SCORE: {passed_evals}/{total_evals} ({overall_accuracy}%)")
    print(f"AVERAGE RESPONSE LATENCY:   {avg_latency}ms")
    print("=" * 70)

    report_payload = {
        "suite_name": "AgriGuard-50-Question-Agronomy-AI-Benchmark",
        "total_questions": total_evals,
        "passed_questions": passed_evals,
        "overall_accuracy_percent": overall_accuracy,
        "average_latency_ms": avg_latency,
        "categories": {
            cat: {
                "total": data["total"],
                "passed": data["passed"],
                "accuracy_percent": round((data["passed"] / data["total"]) * 100.0, 1),
                "avg_latency_ms": round(sum(data["latencies"]) / len(data["latencies"]), 1),
            }
            for cat, data in category_results.items()
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    report_path = Path(__file__).resolve().parent / "ai_evaluation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    print(f"Detailed JSON evaluation report saved to {report_path}")

    return report_payload


if __name__ == "__main__":
    run_ai_evaluation_suite()
