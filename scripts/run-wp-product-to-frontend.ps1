[CmdletBinding()]
param(
  [string]$Spec = "deploy/product-import/wp-product-spec.sample.json",
  [switch]$Publish,
  [switch]$Deploy,
  [switch]$SkipSync,
  [switch]$Headed
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[pipeline] Step 1/3: create Woo product via wp-admin Playwright"
$pyArgs = @("scripts/wp-create-product-playwright.py", "--spec", $Spec)
if ($Publish) { $pyArgs += "--publish" }
if ($Headed) { $pyArgs += "--headed" }
py @pyArgs
if ($LASTEXITCODE -ne 0) {
  throw "[pipeline] product creation failed"
}

if (-not $SkipSync) {
  Write-Host "[pipeline] Step 2/3: sync Woo products/pages into local static data"
  node scripts/sync-from-wp.mjs --site https://carp-ybb.com
  if ($LASTEXITCODE -ne 0) {
    throw "[pipeline] sync-from-wp failed"
  }
}

Write-Host "[pipeline] Step 3/3: build static and optionally deploy"
if ($Deploy) {
  powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1
} else {
  powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipDeploy
}

Write-Host "[pipeline] Done"
