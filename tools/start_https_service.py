#!/usr/bin/env python3
"""
AgriGuard HTTPS Service Orchestrator
Launches backend on port 8000, establishes Cloudflare Edge Tunnel with real TLS certificate,
synchronizes frontend environment, rebuilds frontend assets, and verifies all live endpoints.
"""
import os
import re
import sys
import time
import json
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True)

WORKSPACE = Path(r"c:\sih3")
BACKEND_DIR = WORKSPACE / "backend"
FRONTEND_DIR = WORKSPACE / "frontend"
TOOLS_DIR = WORKSPACE / "tools"
CLOUDFLARED_EXE = TOOLS_DIR / "cloudflared.exe"
PYTHON_EXE = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"

LOG_DIR = WORKSPACE / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_LOG = LOG_DIR / "backend.log"
TUNNEL_LOG = LOG_DIR / "tunnel.log"


def kill_existing_processes():
    """Kill any existing uvicorn or cloudflared processes on port 8000"""
    print("[1/7] Cleaning up existing processes on port 8000...")
    try:
        subprocess.run(
            ["powershell", "-Command", 
             "Get-Process -Name cloudflared, uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"],
            capture_output=True
        )
    except Exception as e:
        print(f"Warning cleaning processes: {e}")
    time.sleep(1)


def start_backend():
    """Start the FastAPI backend with uvicorn"""
    print("[2/7] Starting AgriGuard FastAPI backend on 127.0.0.1:8000...")
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = str(BACKEND_DIR)
    backend_env["RELOAD"] = "false"

    out_file = open(BACKEND_LOG, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [str(PYTHON_EXE), "run.py"],
        cwd=str(BACKEND_DIR),
        stdout=out_file,
        stderr=subprocess.STDOUT,
        env=backend_env
    )

    # Wait for backend health
    max_wait = 20
    start_time = time.time()
    while time.time() - start_time < max_wait:
        try:
            req = urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=2)
            if req.status == 200:
                print(" -> Backend is healthy and listening on http://127.0.0.1:8000")
                return proc
        except Exception:
            time.sleep(0.5)

    print("ERROR: Backend failed to start within 20 seconds. Check logs/backend.log")
    if BACKEND_LOG.exists():
        with open(BACKEND_LOG, "r", encoding="utf-8", errors="ignore") as f:
            print(f.read()[-1000:])
    sys.exit(1)


def start_tunnel():
    """Launch Cloudflare Edge Tunnel with genuine TLS certificate"""
    print("[3/7] Launching Cloudflare Edge Tunnel with real TLS certificate...")
    out_file = open(TUNNEL_LOG, "w", encoding="utf-8")

    tunnel_token = os.environ.get("CLOUDFLARE_TUNNEL_TOKEN") or os.environ.get("TUNNEL_TOKEN")
    
    if tunnel_token and tunnel_token.strip():
        print(" -> Using configured Cloudflare Named Tunnel Token")
        cmd = [str(CLOUDFLARED_EXE), "tunnel", "run", "--token", tunnel_token.strip()]
    else:
        print(" -> Establishing Cloudflare Edge Tunnel on http://127.0.0.1:8000...")
        cmd = [str(CLOUDFLARED_EXE), "tunnel", "--url", "http://127.0.0.1:8000"]

    proc = subprocess.Popen(
        cmd,
        cwd=str(WORKSPACE),
        stdout=out_file,
        stderr=subprocess.STDOUT
    )

    tunnel_url = None
    max_wait = 30
    start_time = time.time()
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    while time.time() - start_time < max_wait:
        if proc.poll() is not None:
            print("ERROR: cloudflared process terminated prematurely.")
            break
        if TUNNEL_LOG.exists():
            try:
                with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    matches = url_pattern.findall(content)
                    if matches:
                        tunnel_url = matches[0]
                        break
            except Exception:
                pass
        time.sleep(0.5)

    if not tunnel_url:
        print("Warning: Cloudflare URL not parsed. Checking fallback...")
        if TUNNEL_LOG.exists():
            with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                print(f.read()[-1000:])
        sys.exit(1)

    print(f" -> SUCCESS! Real Live HTTPS URL: {tunnel_url}")
    return proc, tunnel_url


def update_environment(tunnel_url: str):
    """Write public tunnel URL to environment files"""
    print(f"[4/7] Updating frontend and backend environment configurations with {tunnel_url}...")
    
    # 1. Frontend .env and .env.production
    api_url = f"{tunnel_url}/api"
    env_content = f"""# AgriGuard Production Environment Configuration
VITE_API_BASE_URL={api_url}
VITE_PUBLIC_URL={tunnel_url}
"""
    with open(FRONTEND_DIR / ".env", "w", encoding="utf-8") as f:
        f.write(env_content)
    with open(FRONTEND_DIR / ".env.production", "w", encoding="utf-8") as f:
        f.write(env_content)
    print(" -> Written frontend/.env and frontend/.env.production")

    # 2. Backend .env
    backend_env_path = BACKEND_DIR / ".env"
    lines = []
    if backend_env_path.exists():
        with open(backend_env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    found_pub = False
    for line in lines:
        if line.startswith("PUBLIC_URL="):
            new_lines.append(f"PUBLIC_URL={tunnel_url}\n")
            found_pub = True
        else:
            new_lines.append(line)
    if not found_pub:
        new_lines.append(f"PUBLIC_URL={tunnel_url}\n")

    with open(backend_env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(" -> Updated backend/.env with PUBLIC_URL")


def rebuild_frontend():
    """Build the frontend bundle with npm run build"""
    print("[5/7] Rebuilding production frontend bundle (npm run build)...")
    res = subprocess.run(
        ["npm.cmd", "run", "build"],
        cwd=str(FRONTEND_DIR),
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("ERROR: Frontend build failed:")
        print(res.stderr)
        sys.exit(1)
    print(" -> Frontend build completed successfully into frontend/dist")


def _fetch_with_retry(url: str, headers: dict = None, data: bytes = None, max_retries: int = 5, delay: float = 2.0):
    """Helper to fetch URL with retry for edge DNS propagation"""
    if headers is None:
        headers = {}
    headers.setdefault("User-Agent", "AgriGuard-Verifier/1.0")
    
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers, data=data)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode()) if "json" in resp.headers.get("Content-Type", "") else resp.read().decode()
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(delay)
    raise last_err


def verify_live_endpoints(tunnel_url: str):
    """Perform real HTTPS tests against the live public domain"""
    print(f"[6/7] Verifying live public HTTPS endpoints on {tunnel_url}...")

    # Wait for tunnel edge route propagation
    time.sleep(3)

    # 1. Test Health Endpoint
    health_url = f"{tunnel_url}/api/health"
    print(f" -> Testing {health_url}...")
    health_data = _fetch_with_retry(health_url)
    assert health_data.get("status") == "healthy", f"Unexpected health status: {health_data}"
    print(f"    [PASS] Health check OK: {health_data}")

    # 2. Test Network Info Endpoint
    net_url = f"{tunnel_url}/api/v1/system/network-info"
    print(f" -> Testing {net_url}...")
    net_data = _fetch_with_retry(net_url)
    print(f"    [PASS] Network info OK: share_url={net_data.get('share_url')}")

    # 3. Test Real HTTPS Login
    login_url = f"{tunnel_url}/api/auth/login"
    print(f" -> Testing real login against {login_url}...")
    login_payload = json.dumps({
        "email": "farmer@demo.agriguard.app",
        "password": "Demo@1234"
    }).encode("utf-8")

    login_data = _fetch_with_retry(
        login_url,
        headers={"Content-Type": "application/json"},
        data=login_payload
    )
    token = login_data["access_token"]
    user_role = login_data["user"]["role"]
    assert token, "No access token in login response"
    print(f"    [PASS] Login authenticated! Role: {user_role}, Token: {token[:20]}...")

    # 4. Test Authenticated Dashboard
    dash_url = f"{tunnel_url}/api/dashboard"
    print(f" -> Testing authenticated dashboard {dash_url}...")
    dash_data = _fetch_with_retry(
        dash_url,
        headers={"Authorization": f"Bearer {token}"}
    )
    farms_count = dash_data["stats"]["total_farms"]
    print(f"    [PASS] Dashboard data loaded! Total farms: {farms_count}, User: {dash_data['user']['name']}")

    # 5. Test SPA Delivery
    print(f" -> Testing SPA delivery at {tunnel_url}/...")
    html = _fetch_with_retry(tunnel_url)
    assert "<div id=\"root\"></div>" in html or "AgriGuard" in html
    print(f"    [PASS] Frontend HTML SPA served successfully over HTTPS!")

    print("\n[7/7] All Live HTTPS Verifications PASSED!")
    print("=" * 70)
    print(f"  AGRIGUARD IS LIVE OVER REAL HTTPS ON ALL DEVICES:")
    print(f"  URL: {tunnel_url}")
    print(f"  Login: farmer@demo.agriguard.app / Demo@1234")
    print(f"  Share / PWA / APK Hub: {tunnel_url}/?screen=download")
    print("=" * 70)


def main():
    kill_existing_processes()
    backend_proc = start_backend()
    tunnel_proc, tunnel_url = start_tunnel()
    update_environment(tunnel_url)
    rebuild_frontend()
    verify_live_endpoints(tunnel_url)

    # Save metadata
    meta = {
        "tunnel_url": tunnel_url,
        "api_url": f"{tunnel_url}/api",
        "started_at": time.time(),
        "backend_pid": backend_proc.pid,
        "tunnel_pid": tunnel_proc.pid
    }
    with open(WORKSPACE / "live_https_status.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("\nService running continuously in background. Listening for requests...")
    try:
        while True:
            # Check child processes health
            if backend_proc.poll() is not None:
                print("Backend process died unexpectedly. Exiting...")
                break
            if tunnel_proc.poll() is not None:
                print("Tunnel process died unexpectedly. Exiting...")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping service...")
        backend_proc.terminate()
        tunnel_proc.terminate()


if __name__ == "__main__":
    main()
