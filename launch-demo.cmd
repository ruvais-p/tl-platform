@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-demo.ps1"
set "exitCode=%ERRORLEVEL%"

echo.
if not "%exitCode%"=="0" (
    echo Demo launch failed with exit code %exitCode%.
) else (
    echo Demo launch command completed. Django and Next.js remain running in the background.
)
echo.
pause
exit /b %exitCode%
