@echo off
setlocal
title AgriGuard — Service Status

cd /d "%~dp0.."
set "WORKSPACE=%CD%"
set "SERVICE_NAME=AgriGuardSupervisor"
set "LOG_DIR=%WORKSPACE%\logs"
set "STATUS_JSON=%LOG_DIR%\service_status.json"
set "LIVE_JSON=%WORKSPACE%\live_https_status.json"

echo.
echo  =========================================================
echo   AgriGuard Service Status
echo  =========================================================
echo.

:: Windows Service status
echo  [Windows Service]
sc query "%SERVICE_NAME%" 2>nul | findstr /i "STATE"
if %ERRORLEVEL% NEQ 0 (
    echo    NOT INSTALLED — run tools\install_services.bat as Administrator to install.
)

echo.
echo  [Live HTTPS Status]
if exist "%LIVE_JSON%" (
    type "%LIVE_JSON%"
) else (
    echo    File not found: %LIVE_JSON%
    echo    Service may not have started yet.
)

echo.
echo  [Health Check — Last Ping]
if exist "%STATUS_JSON%" (
    type "%STATUS_JSON%"
) else (
    echo    File not found: %STATUS_JSON%
)

echo.
echo  [Recent Supervisor Log - last 30 lines]
if exist "%LOG_DIR%\supervisor.log" (
    powershell -Command "Get-Content '%LOG_DIR%\supervisor.log' -Tail 30"
) else (
    echo    Log file not found: %LOG_DIR%\supervisor.log
)

echo.
echo  [Port 8000]
netstat -ano | findstr ":8000"
if %ERRORLEVEL% NEQ 0 (
    echo    Nothing listening on port 8000 — backend is not running.
)

echo.
echo  =========================================================
echo   Commands:
echo     Start:   net start AgriGuardSupervisor
echo     Stop:    net stop  AgriGuardSupervisor
echo     Restart: net stop AgriGuardSupervisor ^& net start AgriGuardSupervisor
echo     Remove:  tools\uninstall_services.bat  (run as Admin)
echo  =========================================================
echo.
pause
