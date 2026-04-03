@echo off
echo ========================================
echo   RIDGE-LINK RIG UPDATE
echo ========================================
echo.
echo [1/4] Stashing any local changes...
git stash --include-untracked 2>nul
echo.
echo [2/4] Pulling latest code...
git pull --ff-only
if errorlevel 1 (
    echo.
    echo  WARNING: git pull failed. Trying reset...
    git fetch origin
    git reset --hard origin/main
)
echo.
echo [3/4] Killing Python processes...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo [4/4] Starting rig agent...
call .\START_RIG.bat
