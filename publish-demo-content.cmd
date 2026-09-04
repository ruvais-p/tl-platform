@echo off
setlocal
cd /d "%~dp0"

set "PYTHON=%~dp0venv\Scripts\python.exe"
set "LPP_VIDEO=%USERPROFILE%\Downloads\LPP2.mp4"
set "MULTIVARIABLE_VIDEO=%USERPROFILE%\Downloads\Multivariable_Calculus_Applications_final.mp4"

if not exist "%PYTHON%" (
    echo Python environment is missing. Run setup-project.cmd first.
    pause
    exit /b 1
)
if not exist "%LPP_VIDEO%" (
    echo LPP video was not found: %LPP_VIDEO%
    pause
    exit /b 1
)
if not exist "%MULTIVARIABLE_VIDEO%" (
    echo Multivariable video was not found: %MULTIVARIABLE_VIDEO%
    pause
    exit /b 1
)

"%PYTHON%" "%~dp0tella_backend\manage.py" setup_groups
if errorlevel 1 goto :failed
"%PYTHON%" "%~dp0tella_backend\manage.py" seed_workshop
if errorlevel 1 goto :failed
"%PYTHON%" "%~dp0tella_backend\manage.py" publish_learning_demo --lpp-video "%LPP_VIDEO%" --multivariable-video "%MULTIVARIABLE_VIDEO%"
if errorlevel 1 goto :failed

echo.
echo Demo lessons and videos are ready. Run launch-frontend.cmd to open them.
pause
exit /b 0

:failed
set "exitCode=%ERRORLEVEL%"
echo.
echo Demo content publishing failed with exit code %exitCode%.
pause
exit /b %exitCode%
