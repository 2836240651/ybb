param(
  [switch]$DryRun,
  [switch]$SkipCleanup,
  [switch]$SkipBuild,
  [switch]$AutoUpload
)

Write-Host "[deploy-zip] deprecated — forwarding to deploy-siteground-browser.ps1 (no direct FTPS)"
$forward = @(
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $PSScriptRoot "deploy-siteground-browser.ps1")
)
if ($DryRun) { $forward += "-DryRun" }
if ($SkipBuild) { $forward += "-SkipBuild" }
if ($AutoUpload) { $forward += "-AutoUpload" }
powershell @forward
exit $LASTEXITCODE
