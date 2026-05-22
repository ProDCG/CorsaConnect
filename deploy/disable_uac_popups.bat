@echo off
echo ========================================================
echo Disabling Windows User Account Control (UAC) Pop-ups
echo ========================================================
echo.
echo Note: This requires Administrator privileges. If it fails,
echo right-click this script and select "Run as administrator".
echo.

reg.exe ADD HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System /v EnableLUA /t REG_DWORD /d 0 /f

if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to modify registry. Did you run as administrator?
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ UAC has been completely disabled!
echo ⚠️ YOU MUST RESTART THIS COMPUTER FOR THE CHANGES TO TAKE EFFECT.
echo.
pause
