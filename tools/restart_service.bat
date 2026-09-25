@echo off
:: Self-elevating UAC wrapper
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    powershell -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c \"%~f0\"' -Verb RunAs -Wait"
    exit /b
)

setlocal
title AgriGuard — Restart Service [Admin]
cd /d "%~dp0.."
set "SERVICE_NAME=AgriGuardSupervisor"
set "LOG_DIR=%CD%\logs"

echo.
echo  [*] Stopping %SERVICE_NAME%...
powershell -Command "& net stop '%SERVICE_NAME%'"
timeout /t 8 /nobreak >nul

echo  [*] Starting %SERVICE_NAME%...
powershell -Command "& net start '%SERVICE_NAME%'"
timeout /t 5 /nobreak >nul

echo.
powershell -Command "& sc.exe query '%SERVICE_NAME%'" | findstr "STATE"
echo.
echo  Done. Check logs for startup progress:
echo    %LOG_DIR%\supervisor.log
echo.
pause
