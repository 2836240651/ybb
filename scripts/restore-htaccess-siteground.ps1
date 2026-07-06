param(
  [switch]$DryRun,
  [switch]$AutoUpload,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$py = @("scripts/siteground_deploy_cli.py", "restore-htaccess")
if ($DryRun) { $py += "--dry-run" }
if ($AutoUpload) { $py += "--auto-upload" }
if ($SkipVerify) { $py += "--skip-verify" }

py @py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[restore-htaccess-siteground] OK"
