@echo off
title AgriGuard HTTPS Service
cd /d "%~dp0"
echo ======================================================================
echo   AgriGuard — Starting Live HTTPS Service
echo ======================================================================
backend\.venv\Scripts\python.exe tools\service_supervisor.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] AgriGuard service exited with error code %ERRORLEVEL%.
    pause
)
