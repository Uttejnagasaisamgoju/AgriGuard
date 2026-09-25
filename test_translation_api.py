import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("=== 1. TEST TRANSLATION LANGUAGES ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/translation/languages')
res = urllib.request.urlopen(req)
print('Languages API Status:', res.status)
data = json.loads(res.read().decode('utf-8'))
languages_list = data if isinstance(data, list) else data.get('languages', [])
for l in languages_list:
    print(f"  {l['code']}: {l['name']} ({l['native']})")

print("\n=== 2. TEST GLOSSARY (TELUGU) ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/translation/glossary?language=te')
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))
glossary = data.get('glossary', {})
print(f"Total Telugu terms in glossary: {len(glossary)}")
for term in ['crop', 'farm', 'disease', 'leaf', 'fertilizer', 'pesticide', 'irrigation', 'early blight', 'healthy', 'leaf spot']:
    print(f"  {term} -> {glossary.get(term, 'N/A')}")

print("\n=== 3. TEST GLOSSARY (MARATHI) ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/translation/glossary?language=mr')
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))
glossary = data.get('glossary', {})
print(f"Total Marathi terms in glossary: {len(glossary)}")
for term in ['crop', 'farm', 'disease', 'leaf', 'fertilizer', 'pesticide', 'irrigation', 'early blight', 'healthy', 'leaf spot']:
    print(f"  {term} -> {glossary.get(term, 'N/A')}")

print("\n=== 4. TEST DYNAMIC TRANSLATION (TELUGU) ===")
payload = {
    'text': 'Tomato Early Blight detected. Recommended fungicide treatment immediately.',
    'target_lang': 'te'
}
req = urllib.request.Request('http://127.0.0.1:8000/api/translation/translate', 
                             data=json.dumps(payload).encode('utf-8'),
                             headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))
print(f"Source: {data.get('source_text')}")
print(f"Translated (te): {data.get('translated_text')}")
print(f"Service: {data.get('service')}, Cached: {data.get('cached')}")

print("\n=== 5. TEST DYNAMIC TRANSLATION (MARATHI) ===")
payload = {
    'text': 'Tomato Early Blight detected. Recommended fungicide treatment immediately.',
    'target_lang': 'mr'
}
req = urllib.request.Request('http://127.0.0.1:8000/api/translation/translate', 
                             data=json.dumps(payload).encode('utf-8'),
                             headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))
print(f"Source: {data.get('source_text')}")
print(f"Translated (mr): {data.get('translated_text')}")
print(f"Service: {data.get('service')}, Cached: {data.get('cached')}")

print("\n=== 6. TEST PUBLIC HTTPS TUNNEL ===")
try:
    req = urllib.request.Request('https://promotion-italia-article-outlet.trycloudflare.com/api/translation/languages')
    res = urllib.request.urlopen(req, timeout=10)
    print("Public Tunnel Status:", res.status)
except Exception as e:
    print("Public Tunnel Test Note:", e)
