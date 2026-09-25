import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("Testing Farmer Login over Backend API...")
url = 'http://127.0.0.1:8000/api/auth/login'
headers = {
    'Content-Type': 'application/json',
    'Accept-Language': 'te'
}
payload = {
    'email': 'farmer@demo.agriguard.app',
    'password': 'Demo@1234'
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
try:
    res = urllib.request.urlopen(req)
    print("Login Status:", res.status)
    data = json.loads(res.read().decode('utf-8'))
    user = data.get('user', {})
    print("Logged In User:", user.get('name'), "| Role:", user.get('role'), "| Email:", user.get('email'))
    token = data.get('token')
    print("Token received:", bool(token))
    
    # Test getting farms with user token
    farms_req = urllib.request.Request('http://127.0.0.1:8000/api/farms/', headers={
        'Authorization': f'Bearer {token}',
        'Accept-Language': 'te'
    })
    farms_res = urllib.request.urlopen(farms_req)
    farms_data = json.loads(farms_res.read().decode('utf-8'))
    print("Farms count:", len(farms_data))
    for f in farms_data[:2]:
        print(f"  Farm: {f.get('name')} | Crop: {f.get('crop_type')}")
    print("LOGIN & API TEST: PASS")
except Exception as e:
    print("Auth test error:", e)
