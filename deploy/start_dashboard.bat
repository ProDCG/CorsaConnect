@echo off
REM Helper: runs the Vite dashboard dev server from the correct directory
cd /d "%~dp0..\apps\orchestrator\frontend"
call npm run dev 2>nul
