@echo off
:: Self-elevating UAC wrapper
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    powershell -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c \"%~f0\"' -Verb RunAs -Wait"
    exit /b
)

setlocal
title AgriGuard — Uninstall Windows Services [Admin]
cd /d "%~dp0.."
set "TOOLS=%CD%\tools"
set "NSSM=%TOOLS%\nssm.exe"
set "SERVICE_NAME=AgriGuardSupervisor"

echo.
echo  =========================================================
echo   AgriGuard — Windows Service Uninstaller [Admin]
echo  =========================================================
echo.

powershell -Command "& sc.exe query '%SERVICE_NAME%'" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [INFO] Service %SERVICE_NAME% is not installed. Nothing to do.
    pause & exit /b 0
)

echo  Stopping %SERVICE_NAME%...
"%NSSM%" stop "%SERVICE_NAME%"
timeout /t 5 /nobreak >nul

echo  Removing %SERVICE_NAME%...
"%NSSM%" remove "%SERVICE_NAME%" confirm
if %ERRORLEVEL% EQU 0 (
    echo.
    echo  [SUCCESS] AgriGuardSupervisor has been removed.
) else (
    echo  [ERROR] NSSM remove failed. Trying sc.exe directly...
    powershell -Command "& sc.exe delete '%SERVICE_NAME%'"
)
echo.
pause
