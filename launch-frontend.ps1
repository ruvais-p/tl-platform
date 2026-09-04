# Launch the local Django API and Next.js admin/learner frontend.
# Moodle and PHP are not required for this launcher.
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
if (-not $Root) {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$DjangoRoot = Join-Path $Root "tella_backend"
$FrontendRoot = Join-Path $Root "admin-platform"
$Python = Join-Path $Root "venv\Scripts\python.exe"
$EnvFile = Join-Path $DjangoRoot ".env"
$DjangoUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://localhost:3000"
$StaffLoginUrl = "$FrontendUrl/login"
$StudentLoginUrl = "$FrontendUrl/learn/login"
$LearnerUrl = "$FrontendUrl/learn"

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

function Find-Command([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        return $command.Path
    }
    return $null
}

Write-Host ""
Write-Host "Tella frontend"
Write-Host "=============="
Write-Host "Project: $Root"
Write-Host ""

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Python virtual environment not found at $Python. Run .\setup-project.cmd first."
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Django configuration not found at $EnvFile. Run .\setup-project.cmd first."
}
if (-not (Test-Path -LiteralPath (Join-Path $FrontendRoot "package.json"))) {
    throw "Next.js application was not found at $FrontendRoot."
}

$npm = Find-Command "npm.cmd"
if (-not $npm) {
    throw "npm was not found. Run .\setup-project.cmd first or install Node.js LTS."
}

$pg = Get-Service -Name "postgresql-x64-*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $pg) {
    throw "PostgreSQL Windows service was not found. Run .\setup-project.cmd first."
}
if ($pg.Status -ne "Running") {
    Write-Host "Starting PostgreSQL..."
    try {
        Start-Service -Name $pg.Name
    } catch {
        throw "Could not start $($pg.Name). Start PostgreSQL from Services, then run this script again."
    }
} else {
    Write-Host "PostgreSQL is already running."
}

$env:DJANGO_API_URL = "http://127.0.0.1:8000/api/v1"
$env:ADMIN_SECURE_COOKIES = "false"

if (Test-Port 8000) {
    Write-Host "Django already listening on :8000"
} else {
    Write-Host "Starting Django on :8000 ..."
    Start-Process -FilePath $Python -ArgumentList @("manage.py", "runserver", "0.0.0.0:8000") -WorkingDirectory $DjangoRoot -WindowStyle Hidden
}
Wait-Port 8000 "Django"

Push-Location $FrontendRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $FrontendRoot "node_modules"))) {
        Write-Host "Installing Next.js dependencies..."
        & $npm install
        if ($LASTEXITCODE -ne 0) {
            throw "Next.js dependency installation failed (exit code $LASTEXITCODE)."
        }
    }
} finally {
    Pop-Location
}

if (Test-Port 3000) {
    Write-Host "Next.js already listening on :3000"
} else {
    Write-Host "Starting Next.js on :3000 ..."
    # Webpack is used deliberately here: it is stable across repeated Windows
    # launcher runs even when a previous dev process left Turbopack cache state.
    Start-Process -FilePath $npm -ArgumentList @("run", "dev", "--", "--webpack") -WorkingDirectory $FrontendRoot -WindowStyle Hidden
}
Wait-Port 3000 "Next.js"

Write-Host ""
Write-Host "Opening $LearnerUrl"
Start-Process $LearnerUrl
Write-Host ""
Write-Host "Local demo logins"
Write-Host ""
Write-Host "  Administrator"
Write-Host "    URL:      $StaffLoginUrl"
Write-Host "    Email:    admin@example.com"
Write-Host "    Password: Admin123!"
Write-Host "    Access:   Full system, users, enrollments, curriculum, and content"
Write-Host ""
Write-Host "  Content manager"
Write-Host "    URL:      $StaffLoginUrl"
Write-Host "    Email:    content@example.com"
Write-Host "    Password: Content123!"
Write-Host "    Access:   Lesson content, activities, experiments, practice, and media"
Write-Host ""
Write-Host "  Student"
Write-Host "    URL:      $StudentLoginUrl"
Write-Host "    Email:    student@example.com"
Write-Host "    Password: Student123!"
Write-Host "    Access:   Assigned and published learning content"
Write-Host ""
Write-Host "Django and Next.js will keep running in the background after this window closes."
Write-Host ""
