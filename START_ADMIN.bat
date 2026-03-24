@echo off
REM ═══════════════════════════════════════════════════
REM  RIDGE-LINK ADMIN LAUNCHER
REM  Double-click to start. Opens dashboard automatically.
REM ═══════════════════════════════════════════════════

cd /d "%~dp0"

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║        RIDGE-LINK ADMIN v2.0              ║
echo  ║  Starting orchestrator + dashboard...     ║
echo  ╚═══════════════════════════════════════════╝
echo.

REM Step 1: Start the backend API (in background, no extra window)
if exist "venv\Scripts\python.exe" (
    start "Ridge-Link Backend" /MIN "venv\Scripts\python.exe" apps\orchestrator\main.py
) else (
    start "Ridge-Link Backend" /MIN python apps\orchestrator\main.py
)

REM Step 2: Wait for backend to be ready
echo  [1/3] Backend starting...
timeout /t 3 /nobreak >nul

REM Step 3: Start the frontend dev server (in background)
echo  [2/3] Starting dashboard...
cd apps\orchestrator\frontend
start "Ridge-Link Dashboard" /MIN cmd /c "npm run dev"

REM Step 4: Wait and open browser
cd /d "%~dp0"
timeout /t 5 /nobreak >nul

echo  [3/3] Opening dashboard in browser...
start http://localhost:5173

echo.
echo  ════════════════════════════════════════════
echo   READY! Dashboard is running.
echo   Close this window to keep services running.
echo   To stop: close the minimized terminal windows.
echo  ════════════════════════════════════════════
echo.
pause
