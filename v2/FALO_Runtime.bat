@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo  AI NotebookLM Runtime Lab - Unified Launcher
echo ==============================================
echo.

:: Get project directory
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo [1/4] Environment check
"..\.venv\Scripts\python" environment_check.py
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Environment check failed!
    pause
    exit /b 1
)
echo.

echo [2/4] Resolve port and manage conflicts
for /f "delims=" %%i in ('"..\.venv\Scripts\python" falo_launcher.py') do (
    set "PORT=%%i"
)

if "%PORT%"=="" (
    echo [ERROR] Failed to resolve port via falo_launcher.py!
    pause
    exit /b 1
)

set "LOCAL_URL=http://127.0.0.1:%PORT%"
echo [OK] Resolved Port: %PORT%
echo.

echo [3/4] Launching Python runtime on 0.0.0.0:%PORT%
:: Start python server in a new command window so it runs in background
start "AI Unified Gateway Server" "..\.venv\Scripts\python" runtime_server.py --host 0.0.0.0 --port %PORT% --no-open

:: Wait for server to become ready
echo Waiting for server to become ready...
for /l %%x in (1, 1, 15) do (
    curl -fsS "%LOCAL_URL%/api/status" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        goto :SERVER_READY
    )
    timeout /t 1 /nobreak >nul
)

echo [ERROR] Server failed to start on %LOCAL_URL%
pause
exit /b 1

:SERVER_READY
echo [OK] Runtime ready: %LOCAL_URL%
echo.

echo [4/4] Open local portal
start "" "%LOCAL_URL%"
echo [OK] Portal opened.
echo.
echo Runtime keeps running in the background cmd window.
timeout /t 5 >nul
