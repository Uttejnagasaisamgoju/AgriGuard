#!/usr/bin/env python3
"""
AgriGuard Service Supervisor & Edge Keep-Alive Daemon
======================================================
Designed to run as a Windows Service (via NSSM) under the SYSTEM account.

What it does:
  - Launches the FastAPI backend (uvicorn) on 127.0.0.1:8000
  - Launches Cloudflare Edge Tunnel (cloudflared.exe) pointing at backend
  - Performs automatic self-healing: auto-restarts either process if it dies
  - Edge Keep-Alive: pings backend & public tunnel every 25 s to prevent idle drops
  - Syncs the live tunnel URL to frontend/.env and rebuilds the SPA (only when URL changes)
  - Records health metrics to logs/service_status.json

Named Tunnel (permanent URL) support
  Set CLOUDFLARE_TUNNEL_TOKEN in backend/.env (or as a system env var) to use a
  permanent Cloudflare Named Tunnel instead of a random trycloudflare.com Quick Tunnel.
  With a named tunnel the URL is fixed, so the frontend is never rebuilt unnecessarily.
"""
import os
import re
import sys
import time
import json
import signal
import urllib.request
import urllib.error
import subprocess
from pathlib import Path
from datetime import datetime

# -- Force line-buffered UTF-8 output so NSSM/Windows captures every log line cleanly --
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
except Exception:
    pass

# -- Paths -----------------------------------------------------------------------
WORKSPACE = Path(r"c:\sih3").resolve()
BACKEND_DIR = WORKSPACE / "backend"
FRONTEND_DIR = WORKSPACE / "frontend"
TOOLS_DIR = WORKSPACE / "tools"
CLOUDFLARED_EXE = TOOLS_DIR / "cloudflared.exe"
PYTHON_EXE = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"

LOG_DIR = WORKSPACE / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_LOG    = LOG_DIR / "backend.log"
TUNNEL_LOG     = LOG_DIR / "tunnel.log"
SUPERVISOR_LOG = LOG_DIR / "supervisor.log"
STATUS_JSON    = LOG_DIR / "service_status.json"
LIVE_STATUS    = WORKSPACE / "live_https_status.json"

# -- Globals (populated at runtime) ----------------------------------------------
backend_proc = None
tunnel_proc  = None

# -- Logging ---------------------------------------------------------------------
def log(msg: str):
    ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    try:
        print(line, flush=True)
    except Exception:
        try:
            print(line.encode("ascii", errors="replace").decode("ascii"), flush=True)
        except Exception:
            pass
    try:
        with open(SUPERVISOR_LOG, "a", encoding="utf-8", errors="replace") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── Environment helpers ──────────────────────────────────────────────────────────
def _load_backend_env() -> dict:
    """Parse backend/.env into a dict (simple KEY=VALUE parser)."""
    env = {}
    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    return env


def _get_tunnel_token() -> str | None:
    """Return the Cloudflare Named Tunnel token if configured."""
    # 1. Check system/process environment first (set by NSSM or Windows env)
    for key in ("CLOUDFLARE_TUNNEL_TOKEN", "TUNNEL_TOKEN"):
        val = os.environ.get(key, "").strip()
        if val:
            return val
    # 2. Fall back to backend/.env
    env = _load_backend_env()
    for key in ("CLOUDFLARE_TUNNEL_TOKEN", "TUNNEL_TOKEN"):
        val = env.get(key, "").strip()
        if val:
            return val
    return None


def _read_current_tunnel_url() -> str | None:
    """Read the last-known tunnel URL from the status file."""
    if LIVE_STATUS.exists():
        try:
            with open(LIVE_STATUS, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("tunnel_url") or None
        except Exception:
            pass
    return None


# ── Process management ───────────────────────────────────────────────────────────
def kill_existing_processes():
    """Kill orphaned uvicorn / cloudflared processes and anything on port 8000."""
    log("Cleaning up any orphaned backend and tunnel processes...")
    try:
        subprocess.run(
            ["powershell", "-Command",
             "Get-Process -Name cloudflared, uvicorn -ErrorAction SilentlyContinue | "
             "Stop-Process -Force -ErrorAction SilentlyContinue; "
             "(Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | "
             "ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"],
            capture_output=True, timeout=15
        )
    except Exception as e:
        log(f"Warning during cleanup: {e}")
    time.sleep(1)


def start_backend() -> subprocess.Popen:
    """Start the FastAPI backend via run.py; wait until health check passes."""
    log("Starting AgriGuard FastAPI backend on 127.0.0.1:8000 ...")
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = str(BACKEND_DIR)
    backend_env["RELOAD"]     = "false"

    out_file = open(BACKEND_LOG, "a", encoding="utf-8")
    proc = subprocess.Popen(
        [str(PYTHON_EXE), "run.py"],
        cwd=str(BACKEND_DIR),
        stdout=out_file,
        stderr=subprocess.STDOUT,
        env=backend_env,
        # CREATE_NEW_PROCESS_GROUP so we can signal it cleanly
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    max_wait = 90
    deadline = time.time() + max_wait
    while time.time() < deadline:
        if proc.poll() is not None:
            log(f"ERROR: Backend exited prematurely (code {proc.returncode}). "
                f"Check {BACKEND_LOG}")
            sys.exit(1)
        try:
            req = urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=2)
            if req.status == 200:
                data = json.loads(req.read().decode())
                log(f"  -> Backend healthy (DB: {data.get('database')}, "
                    f"PID: {proc.pid})")
                return proc
        except Exception:
            time.sleep(0.5)

    log(f"ERROR: Backend did not respond within {max_wait}s. Exiting.")
    sys.exit(1)


def start_tunnel() -> tuple[subprocess.Popen, str]:
    """
    Launch cloudflared; return (proc, tunnel_url).

    - Named Tunnel (token set): uses the token; returns the configured hostname
      (reads from LIVE_STATUS if we already know it, so the frontend isn't rebuilt
       unnecessarily on restart).
    - Quick Tunnel (no token): parses the random trycloudflare.com URL from the log.
    """
    token = _get_tunnel_token()
    attempt = 0

    while True:
        attempt += 1
        log_start_offset = TUNNEL_LOG.stat().st_size if TUNNEL_LOG.exists() else 0
        out_file = open(TUNNEL_LOG, "a", encoding="utf-8")

        if token:
            log(f"  -> Using Cloudflare Named Tunnel (attempt {attempt})")
            cmd = [str(CLOUDFLARED_EXE), "tunnel", "--protocol", "http2", "--edge-ip-version", "4", "run", "--token", token]
        else:
            log(f"  -> Launching Cloudflare Quick Tunnel (attempt {attempt}) on http://127.0.0.1:8000 ...")
            cmd = [str(CLOUDFLARED_EXE), "tunnel", "--protocol", "http2", "--edge-ip-version", "4", "--url", "http://127.0.0.1:8000"]

        proc = subprocess.Popen(
            cmd,
            cwd=str(WORKSPACE),
            stdout=out_file,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )

        # --- Named Tunnel: resolve URL ---
        if token:
            time.sleep(6)
            if proc.poll() is not None:
                log("WARNING: cloudflared Named Tunnel exited prematurely. Retrying...")
                time.sleep(3)
                continue

            previous_url = _read_current_tunnel_url()
            if previous_url and "trycloudflare.com" not in previous_url:
                log(f"  -> Named Tunnel running (URL: {previous_url})")
                return proc, previous_url

            url_pattern = re.compile(r"https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
            deadline = time.time() + 30
            while time.time() < deadline:
                if proc.poll() is not None:
                    break
                try:
                    with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                        f.seek(log_start_offset)
                        content = f.read()
                    matches = [
                        m.group(0) for m in url_pattern.finditer(content)
                        if "trycloudflare.com" not in m.group(0) and "cloudflare" not in m.group(0)
                    ]
                    if matches:
                        u = matches[-1]
                        log(f"  -> Named Tunnel URL: {u}")
                        return proc, u
                except Exception:
                    pass
                time.sleep(0.5)

            log("WARNING: Could not determine Named Tunnel URL from log. Using placeholder.")
            return proc, "https://your-named-tunnel.example.com"

        # --- Quick Tunnel: parse trycloudflare.com URL ---
        url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        deadline = time.time() + 50
        while time.time() < deadline:
            if proc.poll() is not None:
                log(f"  -> cloudflared exited early (code {proc.returncode}). Retrying...")
                break
            try:
                with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                    f.seek(log_start_offset)
                    content = f.read()
                matches = url_pattern.findall(content)
                if matches:
                    tunnel_url = matches[-1]
                    log(f"  -> Quick Tunnel URL: {tunnel_url}")
                    return proc, tunnel_url
            except Exception:
                pass
            time.sleep(0.5)

        try:
            proc.kill()
        except Exception:
            pass

        retry_wait = min(attempt * 4, 30)
        log(f"  -> Retrying tunnel startup in {retry_wait}s (attempt {attempt + 1})...")
        time.sleep(retry_wait)


# -- Environment sync & frontend rebuild -----------------------------------------
def update_environment(tunnel_url: str):
    """Write the live tunnel URL to frontend/.env, backend/.env, and status JSON."""
    log(f"Syncing environment -> {tunnel_url} ...")
    api_url = f"{tunnel_url}/api"

    env_content = (
        "# AgriGuard Production Environment -- AUTO-GENERATED by service_supervisor.py\n"
        f"VITE_API_BASE_URL={api_url}\n"
        f"VITE_PUBLIC_URL={tunnel_url}\n"
    )
    for env_file in [FRONTEND_DIR / ".env", FRONTEND_DIR / ".env.production"]:
        env_file.write_text(env_content, encoding="utf-8")

    # Update PUBLIC_URL in backend/.env
    backend_env_path = BACKEND_DIR / ".env"
    if backend_env_path.exists():
        lines = backend_env_path.read_text(encoding="utf-8").splitlines(keepends=True)
        new_lines, found = [], False
        for line in lines:
            if line.startswith("PUBLIC_URL="):
                new_lines.append(f"PUBLIC_URL={tunnel_url}\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"PUBLIC_URL={tunnel_url}\n")
        backend_env_path.write_text("".join(new_lines), encoding="utf-8")

    # Write live_https_status.json
    meta = {
        "tunnel_url": tunnel_url,
        "api_url":    api_url,
        "updated_at": time.time(),
        "status":     "online",
    }
    LIVE_STATUS.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def rebuild_frontend():
    """Rebuild the React SPA so the new tunnel URL is baked into the JS bundle."""
    log("Building production frontend bundle (npm run build) ...")
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    res = subprocess.run(
        [npm, "run", "build"],
        cwd=str(FRONTEND_DIR),
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        log(f"ERROR: Frontend build failed:\n{res.stderr[-2000:]}")
        sys.exit(1)

    # Preserve the signed APK in dist/downloads
    apk_src = FRONTEND_DIR / "public" / "downloads" / "AgriGuard.apk"
    if apk_src.exists():
        import shutil
        dist_dl = FRONTEND_DIR / "dist" / "downloads"
        dist_dl.mkdir(parents=True, exist_ok=True)
        shutil.copy2(apk_src, dist_dl / "AgriGuard.apk")
        log(f"  -> Preserved AgriGuard.apk "
            f"({apk_src.stat().st_size / 1_048_576:.2f} MB) in dist/downloads")

    log("  -> Frontend compiled successfully into frontend/dist")


# ── HTTP helper ─────────────────────────────────────────────────────────────────
def _fetch(url: str, headers: dict = None, data: bytes = None,
           retries: int = 8, delay: float = 3.0):
    hdr = {"User-Agent": "AgriGuard-Supervisor/1.0", **(headers or {})}
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=hdr, data=data)
            with urllib.request.urlopen(req, timeout=12) as resp:
                body = resp.read().decode("utf-8", errors="ignore")
                ct   = resp.headers.get("Content-Type", "")
                return json.loads(body) if "json" in ct else body
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(delay)
    raise last_err


# ── Endpoint verification ────────────────────────────────────────────────────────
def verify_live_endpoints(tunnel_url: str):
    """Smoke-test the live public HTTPS endpoints after startup."""
    log(f"Verifying live endpoints on {tunnel_url} (waiting for edge propagation)...")
    time.sleep(5)
    try:
        health = _fetch(f"{tunnel_url}/api/health")
        assert health.get("status") == "healthy", f"Health degraded: {health}"
        log(f"  [PASS] Health OK (DB: {health.get('database')})")

        login_payload = json.dumps({
            "email":    "farmer@demo.agriguard.app",
            "password": "Demo@1234",
            "role":     "FARMER",
        }).encode()
        login = _fetch(f"{tunnel_url}/api/auth/login",
                       headers={"Content-Type": "application/json"},
                       data=login_payload)
        token = login.get("access_token", "")
        assert token, "No access_token in login response"
        log(f"  [PASS] HTTPS authentication OK (token: {token[:16]}...)")

        dash = _fetch(f"{tunnel_url}/api/dashboard",
                      headers={"Authorization": f"Bearer {token}"})
        log(f"  [PASS] Dashboard OK (farms: {dash['stats']['total_farms']})")

        html = _fetch(tunnel_url)
        assert "AgriGuard" in html or 'id="root"' in html
        log("  [PASS] SPA HTML served over HTTPS")

    except Exception as e:
        log(f"Notice: Endpoint verification encountered an issue ({e}). "
            "Continuing to keep-alive loop — edge DNS may still be propagating.")


# ── Graceful shutdown ────────────────────────────────────────────────────────────
def _shutdown(signum=None, frame=None):
    log("Shutdown signal received -- stopping child processes...")
    for proc, name in [(backend_proc, "backend"), (tunnel_proc, "tunnel")]:
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=10)
                log(f"  -> {name} stopped (exit {proc.returncode})")
            except Exception as e:
                log(f"  -> Warning stopping {name}: {e}")
                try:
                    proc.kill()
                except Exception:
                    pass
    log("AgriGuard supervisor stopped cleanly.")
    sys.exit(0)


# Register signal handlers so Windows SCM STOP command works cleanly
if sys.platform == "win32":
    signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


# ── Main ─────────────────────────────────────────────────────────────────────────
def main():
    global backend_proc, tunnel_proc

    log("=" * 65)
    log("  AgriGuard Resilient Always-On Service Supervisor")
    log("  Running as: " + (os.environ.get("USERNAME") or "SYSTEM"))
    log("=" * 65)

    kill_existing_processes()

    backend_proc = start_backend()

    # Check if the Quick Tunnel URL from the last run is still valid —
    # if so, reuse it (avoids an unnecessary frontend rebuild on every service restart)
    previous_url = _read_current_tunnel_url()
    token = _get_tunnel_token()
    if token:
        log("CLOUDFLARE_TUNNEL_TOKEN detected -- using Named Tunnel (permanent URL)")

    tunnel_proc, tunnel_url = start_tunnel()

    # Only rebuild the frontend when the URL has actually changed
    if tunnel_url != previous_url:
        log(f"Tunnel URL changed ({previous_url} -> {tunnel_url})")
        update_environment(tunnel_url)
        rebuild_frontend()
    else:
        log(f"Tunnel URL unchanged ({tunnel_url}) -- skipping frontend rebuild")

    verify_live_endpoints(tunnel_url)

    log("=" * 65)
    log("  AGRIGUARD IS LIVE")
    log(f"  Public URL : {tunnel_url}")
    log(f"  Local URL  : http://127.0.0.1:8000")
    log(f"  Login      : farmer@demo.agriguard.app / Demo@1234")
    if not token:
        log("  TIP: Set CLOUDFLARE_TUNNEL_TOKEN in backend/.env to get a")
        log("       permanent HTTPS URL that never changes on reboot.")
    log("=" * 65)

    # ── Keep-alive loop ──────────────────────────────────────────────────────────
    start_time   = time.time()
    last_ping    = time.time()
    ping_interval = 25  # seconds
    ping_count   = 0
    consecutive_edge_failures = 0

    while True:
        now = time.time()

        # Self-heal: restart dead child processes
        if backend_proc.poll() is not None:
            log(f"WARNING: Backend died (exit {backend_proc.returncode}). Restarting...")
            backend_proc = start_backend()

        if tunnel_proc.poll() is not None:
            log(f"WARNING: Tunnel died (exit {tunnel_proc.returncode}). Restarting...")
            tunnel_proc, new_url = start_tunnel()
            if new_url != tunnel_url:
                tunnel_url = new_url
                update_environment(tunnel_url)
                rebuild_frontend()

        # Keep-alive ping
        if now - last_ping >= ping_interval:
            last_ping   = now
            ping_count += 1
            t0          = time.time()
            local_ok    = False
            public_ok   = False

            try:
                r = urllib.request.urlopen(
                    "http://127.0.0.1:8000/api/health", timeout=5)
                local_ok = r.status == 200
            except Exception as e:
                log(f"Local health ping failed: {e}")

            last_edge_error = None
            try:
                req = urllib.request.Request(
                    f"{tunnel_url}/api/health",
                    headers={"User-Agent": "AgriGuard-KeepAlive/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    public_ok = resp.status == 200
            except Exception as e:
                last_edge_error = e
                log(f"Public edge keep-alive warning: {e}")

            if public_ok:
                consecutive_edge_failures = 0
            else:
                consecutive_edge_failures += 1
                # cloudflared handles reconnects internally; only restart if persistently down for > 4 min
                is_local_dns_error = "getaddrinfo" in str(last_edge_error)
                if consecutive_edge_failures >= 10 and not is_local_dns_error:
                    log("WARNING: Edge persistently unreachable for > 4 minutes. Restarting Cloudflare tunnel...")
                    try:
                        tunnel_proc.kill()
                    except Exception:
                        pass
                    consecutive_edge_failures = 0

            latency_ms = int((time.time() - t0) * 1000)
            status_str = (
                "online"   if (local_ok and public_ok) else
                "degraded" if local_ok else
                "offline"
            )

            try:
                STATUS_JSON.write_text(json.dumps({
                    "status":         status_str,
                    "uptime_seconds": int(now - start_time),
                    "last_ping":      datetime.now().isoformat(),
                    "ping_count":     ping_count,
                    "latency_ms":     latency_ms,
                    "tunnel_url":     tunnel_url,
                    "backend_pid":    backend_proc.pid,
                    "tunnel_pid":     tunnel_proc.pid,
                    "local_healthy":  local_ok,
                    "public_healthy": public_ok,
                }, indent=2), encoding="utf-8")
            except Exception:
                pass

        time.sleep(1)


if __name__ == "__main__":
    main()
