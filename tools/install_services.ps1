param()

$ErrorActionPreference = 'Stop'
$svcName = 'AgriGuardSupervisor'
$workspace = 'c:\sih3'
$nssm   = Join-Path $workspace 'tools\nssm.exe'
$python = Join-Path $workspace 'backend\.venv\Scripts\python.exe'
$script = Join-Path $workspace 'tools\service_supervisor.py'
$logDir = Join-Path $workspace 'logs'

Write-Host "`n============================================================="
Write-Host "  AgriGuard — Windows Service Installer (PowerShell)"
Write-Host "=============================================================`n"

# Check privileges
$id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [System.Security.Principal.WindowsPrincipal]$id
$isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[*] Not running as Administrator — requesting elevation..."
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'powershell.exe'
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $psi.Verb = 'runas'
    $psi.UseShellExecute = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    exit 0
}

Write-Host "[OK] Running as Administrator"

# Validate files
foreach ($f in @($nssm, $python, $script)) {
    if (-not (Test-Path $f)) {
        Write-Error "Required file not found: $f"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# Stop and remove existing service
$existing = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[*] Stopping existing service..."
    & $nssm stop $svcName 2>$null
    Start-Sleep -Seconds 4
    Write-Host "[*] Removing existing service..."
    & $nssm remove $svcName confirm 2>$null
    Start-Sleep -Seconds 2
}

Write-Host "`n[1/5] Installing $svcName via NSSM..."
& $nssm install $svcName $python $script
if ($LASTEXITCODE -ne 0) {
    Write-Error "NSSM install failed (exit $LASTEXITCODE)"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[2/5] Configuring service settings..."
& $nssm set $svcName AppDirectory $workspace
& $nssm set $svcName AppStdout "$logDir\supervisor.log"
& $nssm set $svcName AppStderr "$logDir\supervisor.log"
& $nssm set $svcName AppStdoutCreationDisposition 4   # append
& $nssm set $svcName AppStderrCreationDisposition 4   # append
& $nssm set $svcName AppRotateFiles 1
& $nssm set $svcName AppRotateBytes 52428800           # 50 MB
& $nssm set $svcName AppThrottle 5000
& $nssm set $svcName AppRestartDelay 30000
& $nssm set $svcName Start SERVICE_DELAYED_AUTO_START
& $nssm set $svcName Description "AgriGuard Backend + Cloudflare Tunnel — 24/7 Agricultural Platform"

Write-Host "[3/5] Setting Windows SCM failure restart actions..."
& sc.exe failure $svcName reset= 300 actions= restart/30000/restart/60000/restart/90000

Write-Host "[4/5] Starting service..."
& $nssm start $svcName
Start-Sleep -Seconds 6

Write-Host "[5/5] Verifying..."
$svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "`n============================================================="
    Write-Host "  [SUCCESS] $svcName is RUNNING as a Windows Service!"
    Write-Host "============================================================="
    Write-Host ""
    Write-Host "  * Starts automatically on every Windows boot"
    Write-Host "  * Auto-restarts within 30s if it crashes"
    Write-Host "  * Runs 24/7 — no terminal or IDE needed"
    Write-Host ""
    Write-Host "  Live URL: check logs\live_https_status.json after ~60s"
    Write-Host "  Status:   tools\service_status.bat"
    Write-Host ""
    Write-Host "  FOR A PERMANENT URL (never changes on reboot):"
    Write-Host "  1. Go to https://one.dash.cloudflare.com/"
    Write-Host "     Zero Trust -> Networks -> Tunnels -> Create a tunnel"
    Write-Host "  2. Copy the token, open backend\.env, add:"
    Write-Host "     CLOUDFLARE_TUNNEL_TOKEN=eyJ...token..."
    Write-Host "  3. Run tools\restart_service.bat"
} else {
    $status = if ($svc) { $svc.Status } else { 'NotFound' }
    Write-Host "`n[WARN] Service status: $status — may still be starting."
    Write-Host "Wait 30s then check: tools\service_status.bat"
    Write-Host "If it fails, read: $logDir\supervisor.log"
}

Write-Host ""
Read-Host "Press Enter to close"
