import sys
sys.path.insert(0, ".")
import json
from app.database.session import SessionLocal
from tests.test_evaluation_runner import setup_eval_users, evaluate_single_response
from app.services.ai_provider_service import ai_service

db = SessionLocal()
users = setup_eval_users(db)
data = json.load(open('tests/evaluation_dataset.json', encoding='utf-8'))

fail_count = 0
for item in data:
    qid = item['id']
    user = users['FARMER_NOSCAN'] if (qid in ['Q-D01', 'Q-D02', 'Q-J05'] and 'last scan' in item['query'].lower()) else users.get(item.get('user_role'), users['FARMER'])
    res = ai_service.generate_response(db, user, item['query'])
    eval_res = evaluate_single_response(item, res['response'])
    if not eval_res['passed']:
        fail_count += 1
        print(f"{qid} ({item['query'][:40]}...): {eval_res['failures']} | REQUIRED: {item.get('required_phrases')}")
print("Total failed:", fail_count)
db.close()
