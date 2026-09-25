import urllib.request
import urllib.error
import json

def test_login(email, password, role):
    req = urllib.request.Request(
        'http://127.0.0.1:3001/api/auth/login',
        data=json.dumps({'email': email, 'password': password, 'role': role}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"SUCCESS for {role} ({email}): user={data['user']['name']}, role={data['user']['role']}, token={data['access_token'][:15]}...")
            return True, data
    except urllib.error.HTTPError as e:
        print(f"HTTPError for {role} ({email}): {e.code} {e.read().decode('utf-8')}")
        return False, None
    except Exception as e:
        print(f"Exception for {role}: {e}")
        return False, None

print("--- Testing all 3 roles through Vite proxy at 3001 ---")
f_ok, f_data = test_login('farmer@demo.agriguard.app', 'Demo@1234', 'FARMER')
o_ok, o_data = test_login('officer@demo.agriguard.app', 'Demo@1234', 'OFFICER')
e_ok, e_data = test_login('expert@demo.agriguard.app', 'Demo@1234', 'EXPERT')

print("\n--- Testing wrong password rejection ---")
w_ok, _ = test_login('farmer@demo.agriguard.app', 'WrongPassword123', 'FARMER')

print("\n--- Testing role mismatch rejection ---")
m_ok, _ = test_login('farmer@demo.agriguard.app', 'Demo@1234', 'OFFICER')

print("\n--- Testing /auth/me with Farmer token ---")
if f_ok:
    req_me = urllib.request.Request(
        'http://127.0.0.1:3001/api/auth/me',
        headers={'Authorization': f"Bearer {f_data['access_token']}"},
        method='GET'
    )
    with urllib.request.urlopen(req_me) as resp:
        me_data = json.loads(resp.read().decode('utf-8'))
        print(f"Auth/me response: {me_data['name']} - Role: {me_data['role']}")

print("\n--- Testing other real user: yash.konda.7@gmail.com ---")
y_ok, y_data = test_login('yash.konda.7@gmail.com', 'Farmer@123', 'FARMER')
