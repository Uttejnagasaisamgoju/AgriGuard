import json

with open("tests/evaluation_dataset.json", "r", encoding="utf-8") as f:
    items = json.load(f)

failed_ids = {
    'Q-A06', 'Q-B04', 'Q-B06', 'Q-B07', 'Q-B08', 'Q-B09', 'Q-B011', 'Q-B013', 'Q-B014',
    'Q-C01', 'Q-C03', 'Q-C08', 'Q-C010', 'Q-D02', 'Q-D06', 'Q-D08', 'Q-E01', 'Q-E05',
    'Q-E06', 'Q-E08', 'Q-E09', 'Q-F05', 'Q-F06', 'Q-F07', 'Q-F09', 'Q-H03', 'Q-H06',
    'Q-I02', 'Q-I03', 'Q-I04', 'Q-I08', 'Q-I09', 'Q-I010', 'Q-J01', 'Q-J03', 'Q-J05',
    'Q-J06', 'Q-J07', 'Q-J08', 'Q-J09'
}

first_batch = {'Q-A06', 'Q-B04', 'Q-B06', 'Q-B07', 'Q-B08', 'Q-B09', 'Q-B011', 'Q-B013', 'Q-B014', 'Q-C01', 'Q-C03', 'Q-C08', 'Q-C010', 'Q-D02', 'Q-D06', 'Q-D08'}
for item in items:
    if item["id"] in first_batch:
        print(f"[{item['id']}] Cat: {item['category']}")
        print(f"  Query: {item['query']}")
        print(f"  Required: {item['required_phrases']}")
        print(f"  Forbidden: {item['forbidden_phrases']}")
        print(f"  Expected: {item['expected_behavior']}")
        print("-" * 60)
