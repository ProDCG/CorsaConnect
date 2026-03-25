@echo off
REM ═══════════════════════════════════════════════════
REM  RIDGE-LINK ADMIN LAUNCHER
REM  Double-click to start. Opens dashboard automatically.
REM ═══════════════════════════════════════════════════

cd /d "%~dp0"

REM --- Guard: Check bootstrap has been run ---
if not exist "ridge_role" (
    echo.
    echo  ERROR: Bootstrap has not been run yet!
    echo  Run "python bootstrap.py" first and select "admin".
    echo.
    pause
    exit /b 1
)

REM --- Guard: Check role is "admin" ---
for /f %%i in (ridge_role) do set ROLE=%%i
if not "%ROLE%"=="admin" (
    echo.
    echo  ERROR: This machine is configured as "%ROLE%", not "admin".
    echo  START_ADMIN.bat can only run on machines bootstrapped as admin.
    echo  If this is wrong, re-run "python bootstrap.py" and select "admin".
    echo.
    pause
    exit /b 1
)

REM --- Guard: Check venv exists ---
if not exist "venv\Scripts\python.exe" (
    echo.
    echo  ERROR: Python virtual environment not found.
    echo  Run "python bootstrap.py" first.
    echo.
    pause
    exit /b 1
)

REM --- Guard: Check frontend exists ---
if not exist "apps\orchestrator\frontend\node_modules" (
    echo.
    echo  ERROR: Frontend dependencies not installed.
    echo  Run "python bootstrap.py" first and select "admin".
    echo.
    pause
    exit /b 1
)

REM --- Launch ---
echo.
echo  ========================================
echo        RIDGE-LINK ADMIN v2.0
echo    Starting orchestrator + dashboard...
echo  ========================================
echo.

echo  [1/3] Backend starting...
start "Ridge-Link Backend" /MIN "venv\Scripts\python.exe" apps\orchestrator\main.py

timeout /t 3 /nobreak >nul

echo  [2/3] Starting dashboard...
cd apps\orchestrator\frontend
start "Ridge-Link Dashboard" /MIN cmd /c "npm run dev"

cd /d "%~dp0"
timeout /t 5 /nobreak >nul

echo  [3/3] Opening dashboard in browser...
start http://localhost:5173

echo.
echo  ========================================
echo   READY! Dashboard is running.
echo   Close this window to keep services running.
echo   To stop: close the minimized terminal windows.
echo  ========================================
echo.
pause
