# Launch the local Tella / Moodle Skill Enhancement demo (native Windows, not Docker).
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
if (-not $Root) {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$Php = Join-Path $Root "tools\php\php.exe"
$Python = Join-Path $Root "venv\Scripts\python.exe"
$PgBin = "C:\Program Files\PostgreSQL\16\bin"
$MoodleUrl = "http://localhost:8080"
$DjangoUrl = "http://127.0.0.1:8000"
$DemoUrl = "$MoodleUrl/local/tella_workshop/index.php"

function Test-Port([int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(400)
        if ($ok) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Wait-Port([int]$Port, [string]$Name, [int]$Seconds = 30) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-Port $Port) {
            Write-Host "  $Name is up on :$Port"
            return
        }
        Start-Sleep -Seconds 1
    }
    throw "$Name did not start on port $Port within $Seconds seconds."
}

Write-Host ""
Write-Host "Tella Skill Enhancement demo"
Write-Host "============================="
Write-Host "Project: $Root"
Write-Host ""

if (-not (Test-Path $Php)) {
    throw "PHP not found at $Php"
}
if (-not (Test-Path $Python)) {
    throw "Python venv not found at $Python"
}

$env:Path = "$(Join-Path $Root 'tools\php');$PgBin;" + $env:Path

$pg = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pg) {
    if ($pg.Status -ne "Running") {
        Write-Host "Starting PostgreSQL..."
        try {
            Start-Service "postgresql-x64-16"
        } catch {
            Write-Host "Could not start PostgreSQL automatically. Start it from Services, then re-run this script."
            throw
        }
    } else {
        Write-Host "PostgreSQL is already running."
    }
} else {
    Write-Host "PostgreSQL Windows service not found (postgresql-x64-16). Assuming it is already available."
}

if (Test-Port 8000) {
    Write-Host "Django already listening on :8000"
} else {
    Write-Host "Starting Django on :8000 ..."
    Start-Process -FilePath $Python -ArgumentList @("manage.py", "runserver", "0.0.0.0:8000") -WorkingDirectory (Join-Path $Root "tella_backend") -WindowStyle Normal
}

if (Test-Port 8080) {
    Write-Host "Moodle already listening on :8080"
} else {
    Write-Host "Starting Moodle on :8080 ..."
    Start-Process -FilePath $Php -ArgumentList @("-S", "0.0.0.0:8080", "router.php") -WorkingDirectory (Join-Path $Root "moodle") -WindowStyle Normal
}

Write-Host "Waiting for services..."
Wait-Port 8000 "Django"
Wait-Port 8080 "Moodle"

Write-Host ""
Write-Host "Opening $DemoUrl"
Start-Process $DemoUrl

Write-Host ""
Write-Host "Moodle:     $MoodleUrl"
Write-Host "Skill Enhancement: $DemoUrl"
Write-Host "Django:     $DjangoUrl/admin/"
Write-Host ""
Write-Host "Logins"
Write-Host "  Moodle        admin / Admin123!"
Write-Host "  Django admin  admin@example.com / Admin123!"
Write-Host ""
Write-Host "Close the two console windows to stop the demo."
Write-Host ""
