@echo off
REM ═══════════════════════════════════════════════════
REM  RIDGE-LINK RIG LAUNCHER
REM  Double-click to start. No terminal needed.
REM ═══════════════════════════════════════════════════

cd /d "%~dp0"

REM --- Guard: Check bootstrap has been run ---
if not exist ".ridge_role" (
    echo.
    echo  ERROR: Bootstrap has not been run yet!
    echo  Run "python bootstrap.py" first and select "rig".
    echo.
    pause
    exit /b 1
)

REM --- Guard: Check role is "rig" ---
set /p ROLE=<.ridge_role
if not "%ROLE%"=="rig" (
    echo.
    echo  ERROR: This machine is configured as "%ROLE%", not "rig".
    echo  START_RIG.bat can only run on machines bootstrapped as a rig.
    echo  If this is wrong, re-run "python bootstrap.py" and select "rig".
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

REM --- Guard: Check rig config exists ---
if not exist "apps\sled\config.json" (
    echo.
    echo  ERROR: Rig config not found (apps\sled\config.json).
    echo  Run "python bootstrap.py" and select "rig" to generate it.
    echo.
    pause
    exit /b 1
)

REM --- Launch ---
REM Try pythonw first (no console window), fall back to python
if exist "venv\Scripts\pythonw.exe" (
    start "" /B "venv\Scripts\pythonw.exe" -m apps.sled.splash
) else (
    start "" /MIN "venv\Scripts\python.exe" -m apps.sled.splash
)
