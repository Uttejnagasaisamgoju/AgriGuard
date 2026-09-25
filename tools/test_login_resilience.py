#!/usr/bin/env python3
"""
AgriGuard Login Resilience & Concurrency Verification Test Suite
Tests:
1. Database WAL concurrency: 20 simultaneous concurrent login write operations
2. Correct vs Wrong password differentiation (401 vs 200)
3. Non-existent email handling
4. Token validity and structure
5. CORS header validation for LAN and mobile origins
6. Database health check probe
"""
import sys
import time
import json
import concurrent.futures
from pathlib import Path
from fastapi.testclient import TestClient

WORKSPACE = Path(r"c:\sih3").resolve()
sys.path.insert(0, str(WORKSPACE / "backend"))

from app.main import app
from app.database.session import engine, SessionLocal
from app.models.user import User

client = TestClient(app)


def test_db_health():
    print("\n--- Test 1: Database Health Check ---")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code} {res.text}"
    data = res.json()
    print(f"Health Response: {data}")
    assert data.get("status") == "healthy", "Status not healthy"
    assert data.get("database") == "healthy", "Database not healthy"
    print(">>> PASS: Database health check OK")


def test_correct_credentials():
    print("\n--- Test 2: Valid Login Credentials ---")
    payload = {
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    }
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "access_token" in data, "No access token"
    assert data["user"]["role"] == "FARMER", "Incorrect role"
    print(f"Login OK: User={data['user']['name']}, Token={data['access_token'][:20]}...")
    print(">>> PASS: Valid login credentials OK")


def test_wrong_credentials():
    print("\n--- Test 3: Wrong Password Immediate 401 Rejection ---")
    payload = {
        "email": "farmer@demo.agriguard.app",
        "password": "IntentionallyWrongPassword123!"
    }
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    data = res.json()
    assert data.get("detail") == "Invalid email or password", f"Unexpected error detail: {data}"
    print(f"Correctly rejected with 401: detail='{data.get('detail')}'")
    print(">>> PASS: Wrong password rejected cleanly with 401")


def test_nonexistent_user():
    print("\n--- Test 4: Non-existent User 401 Rejection ---")
    payload = {
        "email": "nobody_exists_here_999@agriguard.app",
        "password": "SomePassword@123"
    }
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    print(">>> PASS: Non-existent user rejected cleanly with 401")


def test_cors_origins():
    print("\n--- Test 5: CORS Headers for LAN, Local, and Mobile ---")
    origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://localhost",
        "http://192.168.1.45:3001",
        "http://10.0.0.22:3001",
        "https://rob-test.trycloudflare.com",
    ]
    for origin in origins:
        res = client.options(
            "/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
        allow_origin = res.headers.get("access-control-allow-origin")
        assert allow_origin == origin, f"Origin {origin} got allow-origin: {allow_origin}"
        print(f"Origin '{origin}' -> Allowed: '{allow_origin}'")
    print(">>> PASS: CORS correctly handles all local LAN and mobile origins")


def test_concurrent_logins():
    print("\n--- Test 6: 20 Simultaneous Concurrent Logins (WAL Concurrency) ---")
    payload = {
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    }

    def do_login(i):
        client_instance = TestClient(app)
        start = time.time()
        res = client_instance.post("/api/auth/login", json=payload)
        duration = time.time() - start
        return res.status_code, duration

    num_concurrent = 20
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        futures = [executor.submit(do_login, i) for i in range(num_concurrent)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    total_time = time.time() - t0
    status_codes = [r[0] for r in results]
    durations = [r[1] for r in results]

    print(f"Executed {num_concurrent} concurrent logins in {total_time:.2f}s")
    print(f"Status codes: 200s={status_codes.count(200)}, other={len(status_codes) - status_codes.count(200)}")
    print(f"Average latency: {sum(durations)/len(durations)*1000:.1f}ms, Max latency: {max(durations)*1000:.1f}ms")

    assert all(code == 200 for code in status_codes), f"Some concurrent logins failed! {status_codes}"
    print(">>> PASS: 100% of concurrent logins succeeded with zero database locks")


def test_canonical_db_users():
    print("\n--- Test 7: Verify All Registered Users in Canonical DB ---")
    db = SessionLocal()
    users = db.query(User).all()
    emails = [u.email for u in users]
    print(f"Total verified users in DB: {len(users)}")
    for u in users:
        print(f" - {u.email} ({u.role.value}) [Active: {u.is_active}]")
    db.close()
    assert "farmer@demo.agriguard.app" in emails
    assert "uttejnagasai@gmail.com" in emails
    assert "yash.konda.7@gmail.com" in emails
    print(">>> PASS: All users verified in single canonical database")


def main():
    print("=" * 60)
    print("  RUNNING AGRIGUARD LOGIN RESILIENCE TEST SUITE")
    print("=" * 60)

    test_db_health()
    test_correct_credentials()
    test_wrong_credentials()
    test_nonexistent_user()
    test_cors_origins()
    test_concurrent_logins()
    test_canonical_db_users()

    print("\n" + "=" * 60)
    print("  ALL 7 RESILIENCE TESTS PASSED WITH 100% SUCCESS RATE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
