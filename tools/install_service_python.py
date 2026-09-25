#!/usr/bin/env python3
"""
AgriGuard Windows Service Installer
Installs the AgriGuard supervisor as a Windows Service via NSSM.
Run this script as Administrator.
"""
import os
import sys
import time
import subprocess
import ctypes
from pathlib import Path

WORKSPACE = Path(r"c:\sih3")
NSSM      = WORKSPACE / "tools" / "nssm.exe"
PYTHON    = WORKSPACE / "backend" / ".venv" / "Scripts" / "python.exe"
SUPERVISOR= WORKSPACE / "tools" / "service_supervisor.py"
LOG_DIR   = WORKSPACE / "logs"
SVC_NAME  = "AgriGuardSupervisor"


def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def run(args, check=True, capture=False):
    result = subprocess.run(
        args, capture_output=capture, text=True
    )
    if check and result.returncode not in (0, 5):  # 5 = service doesn't exist (ok)
        print(f"  [WARN] Exit {result.returncode}: {' '.join(str(a) for a in args)}")
    return result


def nssm(*args):
    return run([str(NSSM)] + list(args), check=False, capture=False)


def main():
    print("\n" + "=" * 60)
    print("  AgriGuard Windows Service Installer")
    print("=" * 60 + "\n")

    # --- Elevate if needed ---
    if not is_admin():
        print("[*] Not running as Administrator. Re-launching with UAC elevation...")
        params = f'"{sys.executable}" "{__file__}"'
        ret = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, str(Path(__file__)), str(WORKSPACE), 1
        )
        if ret <= 32:
            print(f"[ERROR] Elevation failed (code {ret}). Please right-click and run as Administrator.")
            input("Press Enter to exit...")
        sys.exit(0)

    print("[OK] Running as Administrator\n")

    # --- Validate prerequisites ---
    missing = [str(p) for p in [NSSM, PYTHON, SUPERVISOR] if not p.exists()]
    if missing:
        print("[ERROR] Required files not found:")
        for m in missing:
            print(f"  {m}")
        input("\nPress Enter to exit...")
        sys.exit(1)

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # --- Remove existing service ---
    result = subprocess.run(
        ["sc.exe", "query", SVC_NAME], capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"[*] Stopping and removing existing {SVC_NAME} service...")
        nssm("stop", SVC_NAME)
        time.sleep(4)
        nssm("remove", SVC_NAME, "confirm")
        time.sleep(2)

    # --- Install ---
    print(f"[1/5] Registering {SVC_NAME} service via NSSM...")
    result = subprocess.run(
        [str(NSSM), "install", SVC_NAME, str(PYTHON), str(SUPERVISOR)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"[ERROR] NSSM install failed:\n{result.stdout}\n{result.stderr}")
        input("Press Enter to exit...")
        sys.exit(1)
    print("  -> Installed\n")

    # --- Configure ---
    print("[2/5] Configuring service properties...")
    cfg = [
        ("AppDirectory",                str(WORKSPACE)),
        ("AppStdout",                   str(LOG_DIR / "supervisor.log")),
        ("AppStderr",                   str(LOG_DIR / "supervisor.log")),
        ("AppStdoutCreationDisposition", "4"),   # append
        ("AppStderrCreationDisposition", "4"),   # append
        ("AppRotateFiles",              "1"),
        ("AppRotateBytes",              "52428800"),  # 50 MB
        ("AppThrottle",                 "5000"),
        ("AppRestartDelay",             "30000"),
        ("Start",                       "SERVICE_DELAYED_AUTO_START"),
        ("Description",                 "AgriGuard Backend + Cloudflare Tunnel — 24/7"),
    ]
    for key, val in cfg:
        nssm("set", SVC_NAME, key, val)
    print("  -> Done\n")

    # --- Failure actions via sc.exe ---
    print("[3/5] Setting crash restart policy...")
    subprocess.run(
        ["sc.exe", "failure", SVC_NAME, "reset=", "300",
         "actions=", "restart/30000/restart/60000/restart/90000"],
        capture_output=True
    )
    print("  -> 30s / 60s / 90s backoff restart on crash\n")

    # --- Start ---
    print(f"[4/5] Starting {SVC_NAME}...")
    nssm("start", SVC_NAME)
    time.sleep(8)

    # --- Verify ---
    print("[5/5] Verifying service status...")
    q = subprocess.run(["sc.exe", "query", SVC_NAME], capture_output=True, text=True)
    running = "RUNNING" in q.stdout.upper()

    print("\n" + "=" * 60)
    if running:
        print(f"  [SUCCESS] {SVC_NAME} is RUNNING!")
        print("=" * 60)
        print("\n  What this means:")
        print("    * Service starts automatically on every Windows boot")
        print("    * Auto-restarts within 30 s if the process crashes")
        print("    * Runs 24/7 — no terminal or IDE session needed\n")
        print("  Live URL: check  logs\\live_https_status.json  after ~60 s")
        print("  Status:          tools\\service_status.bat\n")
        print("  FOR A PERMANENT HTTPS URL (never changes on reboot):")
        print("    1. https://one.dash.cloudflare.com/")
        print("       Zero Trust -> Networks -> Tunnels -> Create a tunnel")
        print("    2. Copy the token, open backend\\.env, add:")
        print("       CLOUDFLARE_TUNNEL_TOKEN=eyJ...token...")
        print("    3. Run tools\\restart_service.bat")
    else:
        print(f"  [WARN] Service status unclear. Output:")
        print(q.stdout)
        print(f"\n  Check logs after 30 s:  {LOG_DIR / 'supervisor.log'}")
        print("  Status:                 tools\\service_status.bat")
    print("\n" + "=" * 60)
    input("\nPress Enter to close...")


if __name__ == "__main__":
    main()
