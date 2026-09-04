# Backward-compatible launcher for the Tella learner demo.
# The workshop UI runs in Next.js; Moodle and PHP are not started here.
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
if (-not $Root) {
    $Root = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$FrontendLauncher = Join-Path $Root "launch-frontend.ps1"
if (-not (Test-Path -LiteralPath $FrontendLauncher)) {
    throw "Frontend launcher not found at $FrontendLauncher"
}

& $FrontendLauncher
