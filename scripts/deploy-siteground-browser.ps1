param(
  [switch]$DryRun,
  [switch]$SkipBuild,
  [switch]$AutoUpload,
  [switch]$ManualUpload,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SkipBuild) {
  if (-not (Test-Path "out/index.html") -or -not (Test-Path "deploy/ybb-static-export.zip")) {
    Write-Host "[deploy-siteground] building static export + zip..."
    powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipDeploy
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} elseif (-not (Test-Path "out/index.html")) {
  Write-Error "Missing out/. Run build-static.ps1 first."
} elseif (-not (Test-Path "deploy/ybb-static-export.zip")) {
  Write-Error "Missing deploy/ybb-static-export.zip."
}

$py = @("scripts/siteground_deploy_cli.py", "deploy-static")
if ($DryRun) { $py += "--dry-run" }
if ($AutoUpload) { $py += "--auto-upload" }
if ($ManualUpload) { $py += "--manual-upload" }
if ($SkipVerify) { $py += "--skip-verify" }

py @py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[deploy-siteground] OK https://carp-ybb.com"
