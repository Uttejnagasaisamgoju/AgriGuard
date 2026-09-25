@echo off
:: Self-elevating UAC wrapper — re-launches this script as Administrator
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c \"%~f0\"' -Verb RunAs -Wait"
    exit /b
)

setlocal EnableDelayedExpansion
title AgriGuard — Install Windows Services (Administrator)
cd /d "%~dp0.."

set "WORKSPACE=%CD%"
set "TOOLS=%WORKSPACE%\tools"
set "NSSM=%TOOLS%\nssm.exe"
set "PYTHON=%WORKSPACE%\backend\.venv\Scripts\python.exe"
set "SUPERVISOR=%TOOLS%\service_supervisor.py"
set "LOG_DIR=%WORKSPACE%\logs"
set "SERVICE_NAME=AgriGuardSupervisor"

echo.
echo  =========================================================
echo   AgriGuard — Windows Service Installer  [Running as Admin]
echo  =========================================================
echo.

:: Validate files
if not exist "%NSSM%" (
    echo [ERROR] NSSM not found: %NSSM%
    echo Download it from https://nssm.cc/ and place nssm.exe in the tools\ folder.
    pause & exit /b 1
)
if not exist "%PYTHON%" (
    echo [ERROR] Python venv not found: %PYTHON%
    echo Run: cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
    pause & exit /b 1
)
if not exist "%SUPERVISOR%" (
    echo [ERROR] Supervisor script not found: %SUPERVISOR%
    pause & exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Remove existing service if present
powershell -Command "& sc.exe query '%SERVICE_NAME%'" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Removing existing %SERVICE_NAME% service...
    "%NSSM%" stop "%SERVICE_NAME%" 2>nul
    timeout /t 4 /nobreak >nul
    "%NSSM%" remove "%SERVICE_NAME%" confirm 2>nul
    timeout /t 2 /nobreak >nul
)

echo [1/6] Registering %SERVICE_NAME% as a Windows Service...
"%NSSM%" install "%SERVICE_NAME%" "%PYTHON%" "%SUPERVISOR%"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] NSSM install failed. See output above.
    pause & exit /b 1
)

echo [2/6] Setting working directory...
"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%WORKSPACE%"

echo [3/6] Configuring logging (stdout + stderr to supervisor.log)...
"%NSSM%" set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\supervisor.log"
"%NSSM%" set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\supervisor.log"
:: Append mode (4) — don't truncate log on each restart
"%NSSM%" set "%SERVICE_NAME%" AppStdoutCreationDisposition 4
"%NSSM%" set "%SERVICE_NAME%" AppStderrCreationDisposition 4
:: Rotate log files > 50 MB
"%NSSM%" set "%SERVICE_NAME%" AppRotateFiles 1
"%NSSM%" set "%SERVICE_NAME%" AppRotateBytes 52428800

echo [4/6] Setting startup type to Automatic (Delayed)...
"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_DELAYED_AUTO_START

echo [5/6] Configuring auto-restart on crash (30s / 60s / 90s backoffs)...
:: Throttle: don't restart too fast if it keeps crashing
"%NSSM%" set "%SERVICE_NAME%" AppThrottle 5000
"%NSSM%" set "%SERVICE_NAME%" AppRestartDelay 30000
:: Windows SCM failure actions: restart after 30s, 60s, then 90s forever
powershell -Command "& sc.exe failure '%SERVICE_NAME%' reset= 300 actions= restart/30000/restart/60000/restart/90000"
"%NSSM%" set "%SERVICE_NAME%" Description "AgriGuard Backend + Cloudflare Tunnel — 24/7 Agricultural Platform Service"

echo [6/6] Starting service...
"%NSSM%" start "%SERVICE_NAME%"
timeout /t 6 /nobreak >nul

:: Final status
powershell -Command "& sc.exe query '%SERVICE_NAME%'" | findstr "STATE"
powershell -Command "& sc.exe query '%SERVICE_NAME%'" | findstr /i "RUNNING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo  =========================================================
    echo   [SUCCESS] AgriGuardSupervisor is RUNNING!
    echo  =========================================================
    echo.
    echo   The service will now:
    echo     * Start automatically on every Windows boot
    echo     * Auto-restart within 30s if the process crashes
    echo     * Run 24/7 with NO terminal or IDE session open
    echo.
    echo   Watch it start up (takes ~60s for tunnel):
    echo     tools\service_status.bat
    echo.
    echo   To get a PERMANENT HTTPS URL (never changes on reboot):
    echo     1. Visit https://one.dash.cloudflare.com/
    echo        -^> Zero Trust -^> Networks -^> Tunnels -^> Create a tunnel
    echo     2. Copy the Tunnel Token
    echo     3. Open backend\.env and set:
    echo        CLOUDFLARE_TUNNEL_TOKEN=eyJ...your...token...
    echo     4. Run tools\restart_service.bat  (as Admin)
    echo.
) else (
    echo.
    echo  [WARN] Service may still be starting. Check after 30 seconds:
    echo    tools\service_status.bat
    echo.
    echo  If it fails, read the log:
    echo    %LOG_DIR%\supervisor.log
    echo.
)
pause
