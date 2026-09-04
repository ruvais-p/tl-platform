@echo off
setlocal
cd /d "%~dp0"

echo Tella project setup
echo ===================
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-project.ps1" %*
set "exitCode=%ERRORLEVEL%"

echo.
if not "%exitCode%"=="0" (
    echo Setup failed with exit code %exitCode%.
) else (
    echo Setup finished successfully.
)
echo.
pause
exit /b %exitCode%
