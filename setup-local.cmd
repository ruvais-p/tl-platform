@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Local Windows bootstrap for the Tella Moodle plugin and Django backend.
rem Run from Explorer or a Command Prompt: setup-local.cmd

set "TL_ROOT=%~dp0"
if "%TL_ROOT:~-1%"=="\" set "TL_ROOT=%TL_ROOT:~0,-1%"
set "TL_TEMP=%TEMP%\tella-platform-%RANDOM%%RANDOM%"
set "TL_PYTHON_VERSION=3.12.10"
set "TL_PHP_VERSION=8.3.33"
set "TL_MOODLE_BRANCH=MOODLE_405_STABLE"
set "TL_VENV=%TL_ROOT%\venv"
set "TL_PHP_DIR=%TL_ROOT%\tools\php"
set "TL_MOODLE_DIR=%TL_ROOT%\moodle"
set "TL_BACKEND=%TL_ROOT%\tella_backend"
set "TL_MOODLEDATA=%TL_ROOT%\moodledata"

echo.
echo Tella Learning Platform local setup
echo ==================================
echo Project: %TL_ROOT%
echo.

mkdir "%TL_TEMP%" >nul 2>&1

call :find_python
if errorlevel 1 call :install_python
if errorlevel 1 goto :failed

if not exist "%TL_VENV%\Scripts\python.exe" (
    echo Creating Python virtual environment...
    call %TL_PYTHON% -m venv "%TL_VENV%"
    if errorlevel 1 goto :failed
)

echo Installing Python dependencies...
"%TL_VENV%\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :failed
"%TL_VENV%\Scripts\python.exe" -m pip install -r "%TL_BACKEND%\requirements.txt"
if errorlevel 1 goto :failed

if not exist "%TL_BACKEND%\.env" (
    copy /y "%TL_BACKEND%\.env.example" "%TL_BACKEND%\.env" >nul
    echo Created tella_backend\.env from .env.example.
)

call :install_php
if errorlevel 1 goto :failed
call :configure_php
if errorlevel 1 goto :failed

call :install_moodle_source
if errorlevel 1 goto :failed

call :check_postgres
if errorlevel 1 goto :postgres_missing

echo Checking and preparing the Django backend...
pushd "%TL_BACKEND%"
"%TL_VENV%\Scripts\python.exe" manage.py check
if errorlevel 1 goto :backend_failed
"%TL_VENV%\Scripts\python.exe" manage.py migrate --noinput
if errorlevel 1 goto :backend_failed
"%TL_VENV%\Scripts\python.exe" manage.py setup_groups
if errorlevel 1 goto :backend_failed
"%TL_VENV%\Scripts\python.exe" manage.py seed_workshop
if errorlevel 1 goto :backend_failed
popd

if not exist "%TL_MOODLE_DIR%\config.php" goto :moodle_installer

echo Updating Moodle and preparing the local demo course...
"%TL_PHP_DIR%\php.exe" "%TL_MOODLE_DIR%\admin\cli\upgrade.php" --non-interactive
if errorlevel 1 goto :failed
"%TL_PHP_DIR%\php.exe" "%TL_ROOT%\scripts\create-demo-course.php"
if errorlevel 1 goto :failed
"%TL_PHP_DIR%\php.exe" "%TL_MOODLE_DIR%\admin\cli\purge_caches.php"
if errorlevel 1 goto :failed

echo.
echo Setup complete.
echo Start the demo with launch-demo.cmd.
goto :cleanup

:moodle_installer
echo.
echo Moodle source is installed but has not been configured yet.
echo Starting the Moodle installer at http://localhost:8080 ...
start "Tella Moodle installer" /min /d "%TL_MOODLE_DIR%" "%TL_PHP_DIR%\php.exe" -S 0.0.0.0:8080 router.php
start "" http://localhost:8080/
echo.
echo Complete the Moodle web installer using these values:
echo   Database driver: PostgreSQL (native/pgsql)
echo   Database host:   127.0.0.1
echo   Database name:   moodle
echo   Data directory:  %TL_MOODLEDATA%
echo.
echo Then close the installer server and run setup-local.cmd again.
goto :cleanup

:postgres_missing
echo.
echo PostgreSQL is required before Django or Moodle can be configured.
echo Install PostgreSQL 16, start its service, and create the tella_dev and moodle databases.
echo The default Django credentials are in tella_backend\.env.example.
goto :failed

:backend_failed
popd
echo.
echo Django setup failed. Confirm PostgreSQL has a tella user and tella_dev database matching tella_backend\.env.
goto :failed

:find_python
call python -c "import sys; assert sys.version_info[0] == 3" >nul 2>&1
if not errorlevel 1 (
    set "TL_PYTHON=python"
    goto :eof
)
call py -3.12 -c "import sys; assert sys.version_info[0] == 3" >nul 2>&1
if not errorlevel 1 (
    set "TL_PYTHON=py -3.12"
    goto :eof
)
cmd /c exit /b 1
goto :eof

:install_python
echo Downloading Python %TL_PYTHON_VERSION%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/%TL_PYTHON_VERSION%/python-%TL_PYTHON_VERSION%-amd64.exe' -OutFile (Join-Path $env:TL_TEMP 'python-installer.exe')"
if errorlevel 1 goto :eof
echo Installing Python for the current user...
start /wait "Python installer" "%TL_TEMP%\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=0 Include_test=0
if errorlevel 1 goto :eof
set "TL_PYTHON=%LocalAppData%\Programs\Python\Python312\python.exe"
if not exist "%TL_PYTHON%" (
    echo Python could not be found after installation.
    cmd /c exit /b 1
    goto :eof
)
goto :eof

:install_php
if exist "%TL_PHP_DIR%\php.exe" goto :eof
echo Downloading PHP %TL_PHP_VERSION%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $zip=Join-Path $env:TL_TEMP 'php.zip'; Invoke-WebRequest -Uri 'https://windows.php.net/downloads/releases/php-%TL_PHP_VERSION%-nts-Win32-vs16-x64.zip' -OutFile $zip; New-Item -ItemType Directory -Force -Path $env:TL_PHP_DIR ^| Out-Null; Expand-Archive -LiteralPath $zip -DestinationPath $env:TL_PHP_DIR -Force"
if errorlevel 1 goto :eof
if not exist "%TL_PHP_DIR%\php.exe" (
    cmd /c exit /b 1
    goto :eof
)
goto :eof

:configure_php
echo Configuring PHP for Moodle...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ini=Join-Path $env:TL_PHP_DIR 'php.ini'; if(-not(Test-Path $ini)){Copy-Item (Join-Path $env:TL_PHP_DIR 'php.ini-development') $ini}; $text=[IO.File]::ReadAllText($ini); $text=$text -replace '(?m)^[ \t]*;extension_dir = \"ext\"[ \t]*\r?$', 'extension_dir = \"ext\"'; foreach($extension in 'curl','exif','fileinfo','gd','intl','mbstring','openssl','pdo_pgsql','pgsql','soap','sodium','zip'){ $text=$text -replace ('(?m)^[ \t]*;extension='+$extension+'[ \t]*\r?$'), ('extension='+$extension) }; $text=$text -replace '(?m)^[ \t]*;extension=exif[ \t]*(;.*)?\r?$', 'extension=exif$1'; $text=$text -replace '(?m)^[ \t]*;max_input_vars[ \t]*=[ \t]*\d+[ \t]*\r?$', 'max_input_vars = 5000'; [IO.File]::WriteAllText($ini,$text,[Text.UTF8Encoding]::new($false))"
if errorlevel 1 goto :eof
"%TL_PHP_DIR%\php.exe" -r "foreach(['curl','fileinfo','mbstring','pgsql','zip'] as $extension){if(!extension_loaded($extension)){exit(1);}}"
if errorlevel 1 goto :eof
goto :eof

:install_moodle_source
if exist "%TL_MOODLE_DIR%\index.php" goto :eof
echo Downloading Moodle 4.5 source...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $moodle=$env:TL_MOODLE_DIR; $allowed=@('.phpstorm.meta.php','local','router.php'); $unexpected=Get-ChildItem -LiteralPath $moodle -Force -ErrorAction SilentlyContinue ^| Where-Object {$_.Name -notin $allowed}; if($unexpected){throw ('Moodle directory contains unexpected files: '+($unexpected.Name -join ', '))}; $zip=Join-Path $env:TL_TEMP 'moodle.zip'; $stage=Join-Path $env:TL_TEMP 'moodle-source'; Invoke-WebRequest -Uri 'https://github.com/moodle/moodle/archive/refs/heads/%TL_MOODLE_BRANCH%.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force; $source=Get-ChildItem -LiteralPath $stage -Directory ^| Select-Object -First 1; if(-not $source -or -not(Test-Path (Join-Path $source.FullName 'index.php'))){throw 'Moodle archive did not contain a Moodle root'}; New-Item -ItemType Directory -Force -Path $moodle,$env:TL_MOODLEDATA ^| Out-Null; Get-ChildItem -LiteralPath $source.FullName -Force ^| Where-Object {$_.Name -notin @('.git','local')} ^| ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $moodle -Recurse -Force}"
if errorlevel 1 goto :eof
goto :eof

:check_postgres
powershell -NoProfile -ExecutionPolicy Bypass -Command "$client=New-Object Net.Sockets.TcpClient; try{$client.Connect('127.0.0.1',5432); exit 0} catch {exit 1} finally {$client.Dispose()}"
goto :eof

:cleanup
if exist "%TL_TEMP%" rmdir /s /q "%TL_TEMP%"
endlocal
exit /b 0

:failed
if exist "%TL_TEMP%" rmdir /s /q "%TL_TEMP%"
echo.
echo Setup did not finish. Read the message above, correct the prerequisite, and run setup-local.cmd again.
endlocal
exit /b 1
