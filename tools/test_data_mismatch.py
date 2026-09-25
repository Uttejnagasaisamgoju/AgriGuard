#!/usr/bin/env python3
"""
AgriGuard Data Mismatch Deep-Trace Verification Suite
Tests:
1. Case-insensitivity (UPPERCASE, mixed case)
2. Trailing/leading whitespace tolerance
3. Role scoping validation (Farmer account trying to log in as Officer tab -> 400 Role mismatch)
4. Role scoping success (Account role matching requested tab -> 200)
5. Generic login without role parameter (backwards compatibility -> 200)
6. All 6 accounts verified across all roles (Farmer, Officer, Expert, Admin)
7. Wrong password rejection (401)
"""
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

WORKSPACE = Path(r"c:\sih3").resolve()
with open(WORKSPACE / "live_https_status.json", "r", encoding="utf-8") as f:
    meta = json.load(f)
BASE_URL = meta["tunnel_url"]

print(f"Testing against live public HTTPS endpoint: {BASE_URL}\n")


def post_login(payload):
    url = f"{BASE_URL}/api/auth/login"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def test_case_insensitivity():
    print("--- Test 1: Email Case-Insensitivity ---")
    status, data = post_login({
        "email": "FARMER@DEMO.AGRIGUARD.APP",
        "password": "Demo@1234"
    })
    print(f"UPPERCASE email result: {status}, Role={data.get('user', {}).get('role')}")
    assert status == 200, f"Expected 200, got {status}: {data}"

    status2, data2 = post_login({
        "email": "FaRMeR@DeMo.AgRiGuArD.aPp",
        "password": "Demo@1234"
    })
    print(f"MixedCase email result: {status2}, Role={data2.get('user', {}).get('role')}")
    assert status2 == 200, f"Expected 200, got {status2}: {data2}"
    print(">>> PASS: Email case-insensitivity verified!\n")


def test_whitespace_tolerance():
    print("--- Test 2: Whitespace Tolerance ---")
    status, data = post_login({
        "email": "  farmer@demo.agriguard.app  \t",
        "password": "Demo@1234"
    })
    print(f"Whitespace-padded email result: {status}, Role={data.get('user', {}).get('role')}")
    assert status == 200, f"Expected 200, got {status}: {data}"
    print(">>> PASS: Whitespace tolerance verified!\n")


def test_role_scoping():
    print("--- Test 3: Role Scoping Validation ---")
    # Farmer account attempting to log in as Officer
    status, data = post_login({
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234",
        "role": "OFFICER"
    })
    print(f"Farmer under Officer tab result: {status}, Detail={data.get('detail')}")
    assert status == 400, f"Expected 400 for role mismatch, got {status}"
    assert "Role mismatch" in data.get("detail", ""), f"Unexpected detail: {data}"

    # Farmer account logging in as Farmer
    status_ok, data_ok = post_login({
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234",
        "role": "FARMER"
    })
    print(f"Farmer under Farmer tab result: {status_ok}, Role={data_ok.get('user', {}).get('role')}")
    assert status_ok == 200, f"Expected 200, got {status_ok}"

    # Generic login without role
    status_gen, data_gen = post_login({
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    })
    print(f"Farmer without role param result: {status_gen}, Role={data_gen.get('user', {}).get('role')}")
    assert status_gen == 200, f"Expected 200, got {status_gen}"
    print(">>> PASS: Role scoping validation verified!\n")


def test_all_accounts():
    print("--- Test 4: All Accounts Verification (Farmer, Officer, Expert, Admin) ---")
    accounts = [
        ("farmer@demo.agriguard.app", "Demo@1234", "FARMER"),
        ("officer@demo.agriguard.app", "Demo@1234", "OFFICER"),
        ("expert@demo.agriguard.app", "Demo@1234", "EXPERT"),
        ("admin@demo.agriguard.app", "Admin@1234", "ADMIN"),
        ("uttejnagasai@gmail.com", "Expert@123", "EXPERT"),
        ("yash.konda.7@gmail.com", "Farmer@123", "FARMER"),
    ]
    for email, pwd, expected_role in accounts:
        status, data = post_login({
            "email": email,
            "password": pwd,
            "role": expected_role
        })
        user = data.get("user", {})
        print(f"Account '{email}' [{expected_role}] -> Status={status}, Name={user.get('name')}, Role={user.get('role')}")
        assert status == 200, f"Account {email} failed with {status}: {data}"
        assert user.get("role") == expected_role, f"Role mismatch: {user.get('role')} != {expected_role}"
        assert "access_token" in data, "No access token returned"
    print(">>> PASS: All 6 accounts across all roles authenticated successfully!\n")


def test_wrong_credentials():
    print("--- Test 5: Wrong Password Immediate 401 Rejection ---")
    status, data = post_login({
        "email": "farmer@demo.agriguard.app",
        "password": "CompletelyWrongPassword!999"
    })
    print(f"Wrong password result: {status}, Detail={data.get('detail')}")
    assert status == 401, f"Expected 401, got {status}"
    assert data.get("detail") == "Invalid email or password"
    print(">>> PASS: Wrong credentials correctly and cleanly rejected with 401!\n")


def main():
    test_case_insensitivity()
    test_whitespace_tolerance()
    test_role_scoping()
    test_all_accounts()
    test_wrong_credentials()

    print("=" * 65)
    print("  ALL DATA MISMATCH TESTS PASSED ON LIVE HTTPS EDGE!")
    print("=" * 65)


if __name__ == "__main__":
    main()
