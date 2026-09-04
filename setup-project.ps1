[CmdletBinding()]
param(
    [switch]$WithMoodle,
    [switch]$SkipMoodle,
    [switch]$SkipSeed,
    [switch]$StartAfterSetup,
    [string]$MoodleBranch = "MOODLE_405_STABLE",
    [string]$MoodleDatabase = "moodle_dev"
)

# Native Windows bootstrap for the Tella project.
#
# Installs the tools used by this checkout through winget, prepares the
# Django database and virtual environment, installs the Next.js dependencies,
# and leaves Moodle/PHP out of the local frontend setup. Pass -WithMoodle only
# when explicitly testing the tracked local/tella_workshop plugin in Moodle.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if (-not $Root) {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
}
Set-Location $Root

$DjangoRoot = Join-Path $Root "tella_backend"
$FrontendRoot = Join-Path $Root "admin-platform"
$MoodleRoot = Join-Path $Root "moodle"
$VenvRoot = Join-Path $Root "venv"
$VenvPython = Join-Path $VenvRoot "Scripts\python.exe"
$EnvFile = Join-Path $DjangoRoot ".env"
$EnvExample = Join-Path $DjangoRoot ".env.example"
$MoodleDataRoot = Join-Path $Root "moodledata"
$LocalPhpRoot = Join-Path $Root "tools\php"
$LocalPhpPath = Join-Path $LocalPhpRoot "php.exe"
$PhpDownloadUrl = "https://windows.php.net/downloads/releases/latest/php-8.3-nts-Win32-vs16-x64-latest.zip"
$PrepareMoodle = $WithMoodle -and -not $SkipMoodle

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Write-Info([string]$Message) {
    Write-Host "  $Message"
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @($machinePath, $userPath, $env:Path) | Where-Object { $_ }
    $env:Path = ($parts -join ";")
}

function Find-Executable([string]$Name) {
    Refresh-ProcessPath
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        return $command.Path
    }
    return $null
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $winget = Find-Executable "winget.exe"
    if (-not $winget) {
        throw "winget is required to install $Name. Install App Installer from Microsoft, then run this script again."
    }

    $installed = & $winget list --id $Id --exact --source winget --accept-source-agreements 2>&1
    if (($installed -join "`n") -match [regex]::Escape($Id)) {
        Write-Info "$Name is already installed."
        return
    }

    Write-Info "Installing or verifying $Name ($Id)."
    & $winget install --id $Id --exact --source winget --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget could not install $Name (exit code $LASTEXITCODE)."
    }
    Refresh-ProcessPath
}

function Ensure-Executable {
    param(
        [Parameter(Mandatory = $true)][string]$CommandName,
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    $path = Find-Executable $CommandName
    if (-not $path) {
        Install-WingetPackage -Id $PackageId -Name $DisplayName
        $path = Find-Executable $CommandName
    }
    if (-not $path) {
        throw "$DisplayName was not found after installation. Open a new PowerShell window and run this script again."
    }
    Write-Info "${DisplayName}: $path"
    return $path
}

function Ensure-LocalPhp {
    if (Test-Path -LiteralPath $LocalPhpPath) {
        $installedVersion = ((& $LocalPhpPath -n -r 'echo PHP_MAJOR_VERSION . chr(46) . PHP_MINOR_VERSION;' 2>$null) -join "").Trim()
        if ($installedVersion -eq "8.3") {
            Write-Info "PHP 8.3: $LocalPhpPath"
            return $LocalPhpPath
        }
        Write-Info "Replacing local PHP $installedVersion with PHP 8.3 for Moodle compatibility."
    }

    Install-WingetPackage -Id "Microsoft.VCRedist.2015+.x64" -Name "Microsoft Visual C++ Redistributable (x64)"
    $temporaryZip = Join-Path ([IO.Path]::GetTempPath()) ("tella-php-" + [Guid]::NewGuid().ToString("N") + ".zip")
    $toolsRoot = Split-Path -Parent $LocalPhpRoot
    $stagedPhpRoot = Join-Path $toolsRoot ("php-staged-" + [Guid]::NewGuid().ToString("N"))
    $backupPhpRoot = Join-Path $toolsRoot ("php-backup-" + [Guid]::NewGuid().ToString("N"))
    $installationSucceeded = $false
    $previousProgressPreference = $ProgressPreference
    try {
        $ProgressPreference = "SilentlyContinue"
        Write-Info "Downloading the official PHP Windows ZIP."
        Invoke-WebRequest -Uri $PhpDownloadUrl -OutFile $temporaryZip -UseBasicParsing
        if (-not (Test-Path -LiteralPath $temporaryZip) -or (Get-Item -LiteralPath $temporaryZip).Length -lt 1000000) {
            throw "The PHP download was empty or incomplete."
        }
        New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
        Expand-Archive -LiteralPath $temporaryZip -DestinationPath $stagedPhpRoot -Force
        $stagedPhpPath = Join-Path $stagedPhpRoot "php.exe"
        if (-not (Test-Path -LiteralPath $stagedPhpPath)) {
            throw "The PHP archive did not contain php.exe."
        }
        if (Test-Path -LiteralPath $LocalPhpRoot) {
            Move-Item -LiteralPath $LocalPhpRoot -Destination $backupPhpRoot
        }
        Move-Item -LiteralPath $stagedPhpRoot -Destination $LocalPhpRoot
        $installationSucceeded = $true
    } finally {
        $ProgressPreference = $previousProgressPreference
        if (Test-Path -LiteralPath $temporaryZip) {
            Remove-Item -LiteralPath $temporaryZip -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $stagedPhpRoot) {
            Remove-Item -LiteralPath $stagedPhpRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($installationSucceeded -and (Test-Path -LiteralPath $backupPhpRoot)) {
            Remove-Item -LiteralPath $backupPhpRoot -Recurse -Force -ErrorAction SilentlyContinue
        } elseif (-not $installationSucceeded -and (Test-Path -LiteralPath $backupPhpRoot) -and -not (Test-Path -LiteralPath $LocalPhpRoot)) {
            Move-Item -LiteralPath $backupPhpRoot -Destination $LocalPhpRoot
        }
    }
    if (-not (Test-Path -LiteralPath $LocalPhpPath)) {
        throw "PHP was downloaded but $LocalPhpPath was not created."
    }
    Write-Info "PHP 8.3: $LocalPhpPath"
    return $LocalPhpPath
}

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Fallback = ""
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $Fallback
    }
    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $line -or $line -notmatch "^\s*$Name\s*=\s*(.*)$") {
        return $Fallback
    }
    $value = $matches[1].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    if ($value -eq "") {
        return $Fallback
    }
    return $value
}

function ConvertTo-SqlIdentifier([string]$Value) {
    return '"' + $Value.Replace('"', '""') + '"'
}

function ConvertTo-SqlLiteral([string]$Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertFrom-SecureStringPlainText([Security.SecureString]$Value) {
    if (-not $Value) {
        return ""
    }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory = $true)][string]$PsqlPath,
        [Parameter(Mandatory = $true)][string]$DbHost,
        [Parameter(Mandatory = $true)][string]$DbPort,
        [Parameter(Mandatory = $true)][string]$DbUser,
        [Parameter(Mandatory = $true)][string]$Database,
        [string]$Password = "",
        [string[]]$PsqlArguments = @()
    )

    $hadPassword = Test-Path Env:PGPASSWORD
    $previousPassword = $env:PGPASSWORD
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $env:PGPASSWORD = $Password
        # A failed connection is an expected result while probing for a
        # database that may need to be created. Capture psql diagnostics and
        # inspect its exit code instead of letting PowerShell terminate here.
        $ErrorActionPreference = "Continue"
        $arguments = @("-h", $DbHost, "-p", $DbPort, "-U", $DbUser, "-d", $Database) + $PsqlArguments
        $output = & $PsqlPath @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($hadPassword) {
            $env:PGPASSWORD = $previousPassword
        } else {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
    }

    [PSCustomObject]@{
        ExitCode = $exitCode
        Output = ($output -join [Environment]::NewLine)
    }
}

function Test-PostgresConnection {
    param(
        [Parameter(Mandatory = $true)][string]$PsqlPath,
        [Parameter(Mandatory = $true)][string]$DbHost,
        [Parameter(Mandatory = $true)][string]$DbPort,
        [Parameter(Mandatory = $true)][string]$DbUser,
        [Parameter(Mandatory = $true)][string]$Database,
        [string]$Password = ""
    )

    $result = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $DbUser -Database $Database -Password $Password -PsqlArguments @("-tAc", "SELECT 1")
    return ($result.ExitCode -eq 0 -and $result.Output.Trim() -eq "1")
}

function Get-PostgresService {
    return Get-Service -Name "postgresql-x64-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
}

function Ensure-PostgresService {
    $service = Get-PostgresService
    if (-not $service) {
        Install-WingetPackage -Id "PostgreSQL.PostgreSQL.16" -Name "PostgreSQL 16"
        $service = Get-PostgresService
    }
    if (-not $service) {
        throw "PostgreSQL was installed but no postgresql-x64 service was found. Check the installation, then run this script again."
    }
    if ($service.Status -ne "Running") {
        Write-Info "Starting PostgreSQL service $($service.Name)."
        try {
            Start-Service -Name $service.Name
        } catch {
            throw "Could not start $($service.Name). Run PowerShell as Administrator, start PostgreSQL from Services, and run this script again."
        }
    } else {
        Write-Info "PostgreSQL service $($service.Name) is already running."
    }
}

function Find-Psql {
    $path = Find-Executable "psql.exe"
    if ($path) {
        return $path
    }
    $postgresRoot = Join-Path ${env:ProgramFiles} "PostgreSQL"
    if (Test-Path -LiteralPath $postgresRoot) {
        $candidate = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
        if ($candidate) {
            return $candidate
        }
    }
    return $null
}

function Ensure-PostgresDatabases {
    param(
        [Parameter(Mandatory = $true)][string]$PsqlPath,
        [Parameter(Mandatory = $true)][string]$DbHost,
        [Parameter(Mandatory = $true)][string]$DbPort,
        [Parameter(Mandatory = $true)][string]$AppUser,
        [Parameter(Mandatory = $true)][string]$AppPassword,
        [Parameter(Mandatory = $true)][string[]]$Databases
    )

    $missing = @($Databases | Where-Object {
        -not (Test-PostgresConnection -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $AppUser -Database $_ -Password $AppPassword)
    })
    if ($missing.Count -eq 0) {
        Write-Info "Application PostgreSQL credentials can access: $($Databases -join ', ')."
        return
    }

    # A local development role may already have CREATEDB. Try that path first
    # so a normal checkout does not need to ask for the PostgreSQL superuser
    # password just to create its own development database(s).
    $createdAsAppUser = $true
    foreach ($databaseName in $missing) {
        $databaseIdentifier = ConvertTo-SqlIdentifier $databaseName
        $createDatabase = "CREATE DATABASE $databaseIdentifier OWNER $(ConvertTo-SqlIdentifier $AppUser);"
        $createResult = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $AppUser -Database "postgres" -Password $AppPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-c", $createDatabase)
        if ($createResult.ExitCode -ne 0) {
            $createdAsAppUser = $false
            break
        }
    }
    if ($createdAsAppUser) {
        $stillMissing = @($Databases | Where-Object {
            -not (Test-PostgresConnection -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $AppUser -Database $_ -Password $AppPassword)
        })
        if ($stillMissing.Count -eq 0) {
            Write-Info "Created the missing PostgreSQL database(s) using the application role."
            return
        }
    }

    Write-Info "The following database(s) need provisioning: $($missing -join ', ')."
    $adminUser = Read-Host "PostgreSQL administrator username [postgres]"
    if ([string]::IsNullOrWhiteSpace($adminUser)) {
        $adminUser = "postgres"
    }
    $secureAdminPassword = Read-Host "Password for PostgreSQL administrator $adminUser" -AsSecureString
    $adminPassword = ConvertFrom-SecureStringPlainText $secureAdminPassword

    $adminTest = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-tAc", "SELECT 1")
    if ($adminTest.ExitCode -ne 0) {
        throw "Could not connect to PostgreSQL as $adminUser. No databases were changed."
    }

    $roleName = ConvertTo-SqlIdentifier $AppUser
    $roleLiteral = ConvertTo-SqlLiteral $AppUser
    $passwordLiteral = ConvertTo-SqlLiteral $AppPassword
    $roleCheck = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-tAc", "SELECT 1 FROM pg_roles WHERE rolname = $(ConvertTo-SqlLiteral $AppUser)")
    if ($roleCheck.ExitCode -ne 0) {
        throw "Could not inspect PostgreSQL roles."
    }
    if ($roleCheck.Output.Trim() -eq "1") {
        $roleSql = "ALTER ROLE $roleName WITH LOGIN PASSWORD $passwordLiteral;"
    } else {
        $roleSql = "CREATE ROLE $roleName WITH LOGIN PASSWORD $passwordLiteral;"
    }
    $roleResult = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-c", $roleSql)
    if ($roleResult.ExitCode -ne 0) {
        throw "Could not create or update PostgreSQL role $AppUser."
    }

    foreach ($databaseName in $missing) {
        $databaseLiteral = ConvertTo-SqlLiteral $databaseName
        $databaseIdentifier = ConvertTo-SqlIdentifier $databaseName
        $databaseCheck = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-tAc", "SELECT 1 FROM pg_database WHERE datname = $databaseLiteral")
        if ($databaseCheck.ExitCode -ne 0) {
            throw "Could not inspect PostgreSQL database $databaseName."
        }
        if ($databaseCheck.Output.Trim() -ne "1") {
            $createDatabase = "CREATE DATABASE $databaseIdentifier OWNER $roleName;"
            $createResult = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-c", $createDatabase)
            if ($createResult.ExitCode -ne 0) {
                throw "Could not create PostgreSQL database $databaseName."
            }
        }
        $grantSql = "GRANT ALL PRIVILEGES ON DATABASE $databaseIdentifier TO $roleName;"
        $grantResult = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database "postgres" -Password $adminPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-c", $grantSql)
        if ($grantResult.ExitCode -ne 0) {
            throw "Could not grant access to PostgreSQL database $databaseName."
        }
        $schemaResult = Invoke-Psql -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $adminUser -Database $databaseName -Password $adminPassword -PsqlArguments @("-v", "ON_ERROR_STOP=1", "-c", "GRANT ALL ON SCHEMA public TO $roleName;")
        if ($schemaResult.ExitCode -ne 0) {
            throw "Could not grant schema access in PostgreSQL database $databaseName."
        }
    }

    $stillMissing = @($Databases | Where-Object {
        -not (Test-PostgresConnection -PsqlPath $PsqlPath -DbHost $DbHost -DbPort $DbPort -DbUser $AppUser -Database $_ -Password $AppPassword)
    })
    if ($stillMissing.Count -gt 0) {
        throw "PostgreSQL setup finished, but these databases are still unavailable: $($stillMissing -join ', ')."
    }
    Write-Info "PostgreSQL databases are ready."
}

function Ensure-PhpConfiguration {
    param([Parameter(Mandatory = $true)][string]$PhpPath)

    $phpDirectory = Split-Path -Parent $PhpPath
    $iniPath = Join-Path $phpDirectory "php.ini"
    if (-not (Test-Path -LiteralPath $iniPath)) {
        $developmentIni = Join-Path $phpDirectory "php.ini-development"
        if (Test-Path -LiteralPath $developmentIni) {
            Copy-Item -LiteralPath $developmentIni -Destination $iniPath
            Write-Info "Created PHP configuration at $iniPath."
        }
    }
    if (-not (Test-Path -LiteralPath $iniPath)) {
        Write-Info "PHP has no writable php.ini; continuing with the packaged defaults."
        return
    }

    $requiredExtensions = @("curl", "fileinfo", "gd", "intl", "mbstring", "openssl", "pdo_pgsql", "pgsql", "sodium", "zip")
    $ini = Get-Content -LiteralPath $iniPath -Raw
    $extensionDirectory = (Join-Path $phpDirectory "ext").Replace("\", "/")
    $extensionDirectoryLine = "extension_dir = `"$extensionDirectory`""
    if ($ini -match "(?m)^\s*;?\s*extension_dir\s*=.*$") {
        $ini = $ini -replace "(?m)^\s*;?\s*extension_dir\s*=.*$", $extensionDirectoryLine
    } else {
        $ini += "`r`n$extensionDirectoryLine`r`n"
    }
    $inputVarsLine = "max_input_vars = 5000"
    if ($ini -match "(?m)^\s*;?\s*max_input_vars\s*=.*$") {
        $ini = $ini -replace "(?m)^\s*;?\s*max_input_vars\s*=.*$", $inputVarsLine
    } else {
        $ini += "`r`n$inputVarsLine`r`n"
    }
    foreach ($extension in $requiredExtensions) {
        $pattern = "(?m)^\s*;\s*extension\s*=\s*(?:php_)?$([regex]::Escape($extension))(?:\.dll)?\s*$"
        if ($ini -match $pattern) {
            $ini = [regex]::Replace($ini, $pattern, "extension=$extension")
        } elseif ($ini -notmatch "(?m)^\s*extension\s*=\s*(?:php_)?$([regex]::Escape($extension))(?:\.dll)?\s*$") {
            $ini += "`r`nextension=$extension`r`n"
        }
    }
    Set-Content -LiteralPath $iniPath -Value $ini -Encoding UTF8

    $loadedModules = @(& $PhpPath -m 2>$null | ForEach-Object { $_.Trim().ToLowerInvariant() })
    $missingExtensions = @($requiredExtensions | Where-Object { $loadedModules -notcontains $_.ToLowerInvariant() })
    if ($missingExtensions.Count -gt 0) {
        throw "PHP is missing required extensions: $($missingExtensions -join ', '). Check $iniPath and run the script again."
    }
}

function Ensure-MoodleCore {
    param(
        [Parameter(Mandatory = $true)][string]$GitPath,
        [Parameter(Mandatory = $true)][string]$Branch
    )

    $coreMarker = Join-Path $MoodleRoot "lib\moodlelib.php"
    if (Test-Path -LiteralPath $coreMarker) {
        Write-Info "Moodle core is already present in $MoodleRoot."
        return
    }

    Write-Info "Downloading Moodle branch $Branch. This can take a few minutes."
    $temporaryMoodle = Join-Path ([IO.Path]::GetTempPath()) ("tella-moodle-" + [Guid]::NewGuid().ToString("N"))
    try {
        New-Item -ItemType Directory -Path $temporaryMoodle -Force | Out-Null
        Invoke-Checked -FilePath $GitPath -Arguments @("clone", "--depth", "1", "--branch", $Branch, "https://github.com/moodle/moodle.git", $temporaryMoodle) -FailureMessage "Moodle download failed"
        Get-ChildItem -LiteralPath $temporaryMoodle -Force |
            Where-Object { $_.Name -ne ".git" } |
            Copy-Item -Destination $MoodleRoot -Recurse -Force
    } finally {
        if (Test-Path -LiteralPath $temporaryMoodle) {
            Remove-Item -LiteralPath $temporaryMoodle -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    if (-not (Test-Path -LiteralPath $coreMarker)) {
        throw "Moodle was downloaded, but its core files were not copied into $MoodleRoot."
    }
}

try {
    Write-Host ""
    Write-Host "Tella project setup" -ForegroundColor Green
    Write-Host "===================" -ForegroundColor Green
    Write-Info "Project: $Root"

    Write-Step "Installing required runtimes"
    $node = Ensure-Executable -CommandName "node.exe" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    $npm = Ensure-Executable -CommandName "npm.cmd" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "npm"
    $systemPython = Ensure-Executable -CommandName "python" -PackageId "Python.Python.3.12" -DisplayName "Python 3.12"
    $php = $null
    $git = $null
    if ($PrepareMoodle) {
        $php = Ensure-LocalPhp
        $git = Ensure-Executable -CommandName "git.exe" -PackageId "Git.Git" -DisplayName "Git"
        Ensure-PhpConfiguration -PhpPath $php
    }

    Write-Step "Creating local configuration"
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
        Write-Info "Created $EnvFile from .env.example."
    } else {
        Write-Info "$EnvFile already exists; leaving it unchanged."
    }

    $djangoDbHost = Get-DotEnvValue -Path $EnvFile -Name "POSTGRES_HOST" -Fallback "127.0.0.1"
    $djangoDbPort = Get-DotEnvValue -Path $EnvFile -Name "POSTGRES_PORT" -Fallback "5432"
    $djangoDbName = Get-DotEnvValue -Path $EnvFile -Name "POSTGRES_DB" -Fallback "tella_dev"
    $djangoDbUser = Get-DotEnvValue -Path $EnvFile -Name "POSTGRES_USER" -Fallback "tella"
    $djangoDbPassword = Get-DotEnvValue -Path $EnvFile -Name "POSTGRES_PASSWORD" -Fallback "tella_dev_local"
    $moodleSsoSecret = Get-DotEnvValue -Path $EnvFile -Name "MOODLE_SSO_SECRET" -Fallback "tella-dev-sso-secret-change-me"

    Write-Step "Preparing PostgreSQL"
    Ensure-PostgresService
    $psql = Find-Psql
    if (-not $psql) {
        throw "psql.exe was not found after PostgreSQL setup. Open a new PowerShell window and run this script again."
    }
    $databaseList = @($djangoDbName)
    if ($PrepareMoodle) {
        if ($MoodleDatabase -eq $djangoDbName) {
            throw "MoodleDatabase must be different from the Django database $djangoDbName."
        }
        $databaseList += $MoodleDatabase
    }
    Ensure-PostgresDatabases -PsqlPath $psql -DbHost $djangoDbHost -DbPort $djangoDbPort -AppUser $djangoDbUser -AppPassword $djangoDbPassword -Databases $databaseList

    Write-Step "Preparing Django"
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Write-Info "Creating Python virtual environment."
        Invoke-Checked -FilePath $systemPython -Arguments @("-m", "venv", $VenvRoot) -FailureMessage "Python virtual environment creation failed"
    } else {
        Write-Info "Python virtual environment already exists."
    }
    Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip") -FailureMessage "pip upgrade failed"
    Invoke-Checked -FilePath $VenvPython -Arguments @("-m", "pip", "install", "-r", (Join-Path $DjangoRoot "requirements.txt")) -FailureMessage "Django dependency installation failed"
    Invoke-Checked -FilePath $VenvPython -Arguments @((Join-Path $DjangoRoot "manage.py"), "migrate") -FailureMessage "Django migrations failed"
    Invoke-Checked -FilePath $VenvPython -Arguments @((Join-Path $DjangoRoot "manage.py"), "setup_groups") -FailureMessage "Django role setup failed"
    if (-not $SkipSeed) {
        Invoke-Checked -FilePath $VenvPython -Arguments @((Join-Path $DjangoRoot "manage.py"), "seed_workshop") -FailureMessage "Django demo data seeding failed"
        $demoContentArguments = @((Join-Path $DjangoRoot "manage.py"), "publish_learning_demo")
        $downloadsRoot = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"
        $lppVideo = Join-Path $downloadsRoot "LPP2.mp4"
        $multivariableVideo = Join-Path $downloadsRoot "Multivariable_Calculus_Applications_final.mp4"
        if ((Test-Path -LiteralPath $lppVideo) -and (Test-Path -LiteralPath $multivariableVideo)) {
            $demoContentArguments += @("--lpp-video", $lppVideo, "--multivariable-video", $multivariableVideo)
            Write-Info "Found the Business Mathematics lesson videos in Downloads; attaching them to the demo."
        } else {
            Write-Info "Lesson MP4s were not found in Downloads; publishing the data-driven demo with video activities left in draft."
        }
        Invoke-Checked -FilePath $VenvPython -Arguments $demoContentArguments -FailureMessage "Demo learning-content publishing failed"
    }

    Write-Step "Preparing the Next.js application"
    Push-Location $FrontendRoot
    try {
        Invoke-Checked -FilePath $npm -Arguments @("install") -FailureMessage "Next.js dependency installation failed"
    } finally {
        Pop-Location
    }

    if ($PrepareMoodle) {
        Write-Step "Preparing Moodle"
        Ensure-MoodleCore -GitPath $git -Branch $MoodleBranch
        if (-not (Test-Path -LiteralPath $MoodleDataRoot)) {
            New-Item -ItemType Directory -Path $MoodleDataRoot -Force | Out-Null
        }
        $moodleConfig = Join-Path $MoodleRoot "config.php"
        if (-not (Test-Path -LiteralPath $moodleConfig)) {
            $moodleInstallArguments = @(
                (Join-Path $MoodleRoot "admin\cli\install.php"),
                "--non-interactive",
                "--agree-license",
                "--adminuser=admin",
                "--adminpass=Admin123!",
                "--adminemail=admin@example.com",
                "--wwwroot=http://localhost:8080",
                "--dataroot=$MoodleDataRoot",
                "--dbtype=pgsql",
                "--dbhost=$djangoDbHost",
                "--dbname=$MoodleDatabase",
                "--dbuser=$djangoDbUser",
                "--dbpass=$djangoDbPassword",
                "--dbport=$djangoDbPort",
                "--fullname=Tella Learning Dev",
                "--shortname=Tella"
            )
            Invoke-Checked -FilePath $php -Arguments $moodleInstallArguments -FailureMessage "Moodle installation failed"
        } else {
            Write-Info "Moodle config.php already exists; skipping first-time installation."
            Invoke-Checked -FilePath $php -Arguments @((Join-Path $MoodleRoot "admin\cli\upgrade.php"), "--non-interactive") -FailureMessage "Moodle upgrade failed"
        }
        Invoke-Checked -FilePath $php -Arguments @((Join-Path $MoodleRoot "admin\cli\purge_caches.php")) -FailureMessage "Moodle cache purge failed"
        Write-Info "Moodle plugin API URL: http://127.0.0.1:8000; local SSO secret comes from tella_backend\.env."
    }

    Write-Host ""
    Write-Host "Setup completed." -ForegroundColor Green
    Write-Host "" 
    Write-Host "Tella staff:   http://localhost:3000/login"
    Write-Host "Tella learner: http://localhost:3000/learn/login"
    if ($PrepareMoodle) {
        Write-Host "Moodle:        http://localhost:8080"
        Write-Host "Tella plugin:  http://localhost:8080/local/tella_workshop/index.php"
    }
    Write-Host ""
    Write-Host "Run .\launch-demo.cmd (or .\launch-frontend.cmd) to start Django + Next.js and open the learner frontend."

    if ($StartAfterSetup) {
        & (Join-Path $Root "launch-demo.ps1")
    }
} catch {
    Write-Host ""
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
