@echo off
REM ═══════════════════════════════════════════════════
REM  RIDGE-LINK RIG LAUNCHER
REM  Double-click to start. No terminal needed.
REM ═══════════════════════════════════════════════════

cd /d "%~dp0"

REM Use venv Python if available, otherwise system Python
if exist "venv\Scripts\pythonw.exe" (
    start "" /B "venv\Scripts\pythonw.exe" -m apps.sled.splash
) else (
    start "" /B pythonw -m apps.sled.splash
)
