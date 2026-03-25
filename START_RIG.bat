@echo off
REM ═══════════════════════════════════════════════════
REM  RIDGE-LINK RIG LAUNCHER
REM  Double-click to start. No terminal needed.
REM ═══════════════════════════════════════════════════

cd /d "%~dp0"

REM Try pythonw first (no console window), fall back to python
if exist "venv\Scripts\pythonw.exe" (
    start "" /B "venv\Scripts\pythonw.exe" -m apps.sled.splash
) else if exist "venv\Scripts\python.exe" (
    start "" /MIN "venv\Scripts\python.exe" -m apps.sled.splash
) else (
    echo ERROR: Virtual environment not found. Run bootstrap.py first.
    pause
)
