import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3001"

def test_login(email, password, role=None):
    payload = {"email": email, "password": password}
    if role:
        payload["role"] = role
    res = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
    return res

def test_me(access_token):
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    return res

def test_forgot_password(email):
    res = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
    return res

def test_change_password(access_token, current_password, new_password):
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.post(
        f"{BASE_URL}/api/auth/change-password",
        json={"current_password": current_password, "new_password": new_password},
        headers=headers,
    )
    return res

def run_tests():
    print("=== TEST 1: Login end-to-end for all three roles ===")
    roles = [
        ("farmer@demo.agriguard.app", "Demo@1234", "FARMER"),
        ("officer@demo.agriguard.app", "Demo@1234", "OFFICER"),
        ("expert@demo.agriguard.app", "Demo@1234", "EXPERT"),
    ]
    tokens = {}
    for email, pw, role in roles:
        res = test_login(email, pw, role)
        assert res.status_code == 200, f"Login failed for {role}: {res.status_code} {res.text}"
        data = res.json()
        assert "access_token" in data, f"No access_token for {role}"
        assert data["user"]["role"] == role, f"Role mismatch for {role}: {data['user']['role']}"
        tokens[role] = data["access_token"]
        print(f"  [PASS] {role} login successful. User: {data['user']['name']}, Role: {data['user']['role']}")

    print("\n=== TEST 2: Session validation via /api/auth/me ===")
    for role, token in tokens.items():
        res = test_me(token)
        assert res.status_code == 200, f"/me failed for {role}: {res.status_code}"
        user_info = res.json()
        assert user_info["role"] == role
        print(f"  [PASS] /me valid for {role}: {user_info['email']} (role: {user_info['role']})")

    print("\n=== TEST 3: Wrong credentials rejection ===")
    # Wrong password
    res = test_login("farmer@demo.agriguard.app", "WrongPassword123!", "FARMER")
    assert res.status_code == 401, f"Expected 401 for wrong password, got {res.status_code}"
    print(f"  [PASS] Wrong password rejected with 401: {res.json().get('detail')}")

    # Non-existent user
    res = test_login("nonexistent_user_99999@agriguard.app", "SomePassword123!", "FARMER")
    assert res.status_code == 401, f"Expected 401 for nonexistent user, got {res.status_code}"
    print(f"  [PASS] Nonexistent user rejected with 401: {res.json().get('detail')}")

    # Role mismatch rejection
    res = test_login("farmer@demo.agriguard.app", "Demo@1234", "OFFICER")
    assert res.status_code == 400, f"Expected 400 for role mismatch, got {res.status_code}"
    print(f"  [PASS] Role mismatch rejected with 400: {res.json().get('detail')}")

    print("\n=== TEST 4: Forgot Password for non-existent account ===")
    res = test_forgot_password("totally_fake_account_12345@nowhere.com")
    assert res.status_code == 200
    msg = res.json().get("message")
    assert "If an account exists" in msg
    print(f"  [PASS] Non-existent email returns generic message without error: {msg}")

    print("\n=== TEST 5: Forgot Password real flow with temporary password ===")
    # Create or use a dedicated test user for forgot password
    from app.database.session import SessionLocal
    from app.models.user import User, UserRole
    from app.auth.security import hash_password
    db = SessionLocal()
    test_email = "forgot_flow_test@agriguard.app"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        user = User(
            name="Forgot Flow Tester",
            email=test_email,
            password_hash=hash_password("InitialSecret@123"),
            role=UserRole.FARMER,
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.password_hash = hash_password("InitialSecret@123")
        user.must_change_password = False
        user.temp_password_expires = None
        db.commit()
    db.close()

    # Trigger forgot-password
    res = test_forgot_password(test_email)
    assert res.status_code == 200
    print(f"  [PASS] Forgot password requested successfully: {res.json().get('message')}")

    # Inspect last sent email from json log
    with open("logs/last_email_sent.json", "r", encoding="utf-8") as f:
        email_data = json.load(f)
    assert email_data["to"] == test_email, f"Expected email to {test_email}, got {email_data['to']}"
    temp_pw = email_data["temp_password"]
    print(f"  [PASS] Verified email generated and logged. Temp password: {temp_pw[:3]}***{temp_pw[-3:]}")

    # Check database state
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    assert user.must_change_password is True, "must_change_password should be True"
    assert user.temp_password_expires is not None, "temp_password_expires should be set"
    db.close()
    print("  [PASS] Database state: must_change_password=True, expiry window active")

    # Old password should no longer work
    res = test_login(test_email, "InitialSecret@123", "FARMER")
    assert res.status_code == 401, "Old password should be invalidated"
    print("  [PASS] Old password successfully invalidated")

    # Login with new temporary password
    res = test_login(test_email, temp_pw, "FARMER")
    assert res.status_code == 200, f"Login with temp password failed: {res.text}"
    login_data = res.json()
    assert login_data["user"]["must_change_password"] is True, "must_change_password flag must be present in response"
    temp_access_token = login_data["access_token"]
    print("  [PASS] Successfully logged in with temporary password. must_change_password is True")

    # Force change password to permanent password
    new_perm_pw = "NewPermanentSecret@2026!"
    res = test_change_password(temp_access_token, temp_pw, new_perm_pw)
    assert res.status_code == 200, f"Change password failed: {res.text}"
    changed_user = res.json()["user"]
    assert changed_user["must_change_password"] is False
    print("  [PASS] Permanent password set successfully. must_change_password reset to False")

    # Verify login with new permanent password
    res = test_login(test_email, new_perm_pw, "FARMER")
    assert res.status_code == 200
    assert res.json()["user"]["must_change_password"] is False
    print("  [PASS] Login with new permanent password succeeds! Full lifecycle verified.")

    print("\n=== TEST 6: Temporary password expiration enforcement ===")
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user.temp_password_expires = datetime.utcnow() - timedelta(minutes=10) # expired
    db.commit()
    db.close()

    res = test_login(test_email, new_perm_pw, "FARMER")
    # Because temp_password_expires was set in the past, authenticate_user enforces expiration
    assert res.status_code == 401
    assert "expired" in res.json().get("detail", "").lower()
    print(f"  [PASS] Expired password rejected: {res.json().get('detail')}")

    # Reset test user expiry so it's clean
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user.temp_password_expires = None
    db.commit()
    db.close()

    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
