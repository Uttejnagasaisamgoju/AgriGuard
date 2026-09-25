import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = 'https://promotion-italia-article-outlet.trycloudflare.com/api/translation/languages'
req = urllib.request.Request(url, headers={'User-Agent': 'AgriGuard-Verifier/1.0'})
try:
    res = urllib.request.urlopen(req, timeout=12)
    print('Tunnel Status:', res.status)
    data = json.loads(res.read().decode('utf-8'))
    print(f'Public Languages count: {len(data)}')
    for l in data:
        print(f"  {l['code']}: {l['name']} ({l['native']})")
    print('PUBLIC TUNNEL VERIFICATION: PASS')
except Exception as e:
    print('Tunnel verification error:', e)
