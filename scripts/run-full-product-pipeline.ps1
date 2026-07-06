# Full pipeline: product form xlsx -> WooCommerce -> static frontend -> deploy
[CmdletBinding()]
param(
  [string]$Xlsx,
  [string]$ImageDir,
  [string]$SiteUrl = 'https://carp-ybb.com',
  [string]$MigrateKey = 'ybb-migrate-20260624',
  [switch]$SkipImages,
  [switch]$SkipWoo,
  [switch]$SkipDeploy,
  [switch]$DryRunWoo
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not $Xlsx) {
  $Xlsx = Join-Path $env:USERPROFILE 'Desktop\产品表单.xlsx'
}
if (-not $ImageDir) {
  $ImageDir = Join-Path $env:USERPROFILE 'Pictures\excel表单图'
}

if (-not (Test-Path $Xlsx)) {
  throw "Excel not found: $Xlsx"
}

function Invoke-WcUrl([string]$PathAndQuery) {
  $sep = if ($PathAndQuery -match '\?') { '&' } else { '?' }
  $url = "$SiteUrl/$PathAndQuery${sep}nocache=1"
  Write-Host "[wc] GET $url"
  $raw = curl.exe -sS $url
  if ($LASTEXITCODE -ne 0) { throw "curl failed: $url" }
  Write-Host $raw
  return $raw | ConvertFrom-Json
}

Write-Host '=== Step 1/9: parse product form ==='
py scripts/parse-product-form.py --xlsx $Xlsx
if ($LASTEXITCODE -ne 0) { throw 'parse-product-form failed' }

if (-not $SkipImages) {
  Write-Host '=== Step 2/9: extract DISPIMG images from xlsx ==='
  py scripts/extract-product-images.py --xlsx $Xlsx --output $ImageDir
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'extract-product-images reported missing media; continuing'
  }

  Write-Host '=== Step 3/9: build assets-manifest.csv ==='
  node scripts/build-assets-manifest.mjs --image-dir $ImageDir
  if ($LASTEXITCODE -gt 2) { throw 'build-assets-manifest failed' }
}

Write-Host '=== Step 4/9: bootstrap products.json from catalog ==='
node scripts/sync-from-wp.mjs --site $SiteUrl --from-catalog
if ($LASTEXITCODE -ne 0) { throw 'sync-from-wp --from-catalog failed' }

if (-not $SkipImages) {
  Write-Host '=== Step 5/9: export webp masters to public/products ==='
  node scripts/export-product-images.mjs --all
  if ($LASTEXITCODE -ne 0) { throw 'export-product-images failed' }

  Write-Host '=== Step 6/9: audit image closure ==='
  node scripts/audit-product-images.mjs --site $SiteUrl
}

if (-not $SkipWoo) {
  Write-Host '=== Step 7/9: upload product-import + WC sync PHP ==='
  py scripts/upload-product-import.py
  if ($LASTEXITCODE -ne 0) { throw 'upload-product-import failed' }

  if ($DryRunWoo) {
    Invoke-WcUrl "wc-cleanup-products.php?key=$MigrateKey&dry_run=1" | Out-Null
    Invoke-WcUrl "sync-wc-products.php?key=$MigrateKey&dry_run=1" | Out-Null
    Write-Host '[pipeline] DryRunWoo complete - no Woo changes applied'
  } else {
    Invoke-WcUrl "wc-cleanup-products.php?key=$MigrateKey&dry_run=1" | Out-Null
    Invoke-WcUrl "sync-wc-products.php?key=$MigrateKey&dry_run=1" | Out-Null
    Invoke-WcUrl "wc-cleanup-products.php?key=$MigrateKey" | Out-Null
    Invoke-WcUrl "sync-wc-products.php?key=$MigrateKey" | Out-Null
    Invoke-WcUrl "sync-wc-hot-products.php?key=$MigrateKey" | Out-Null
    Invoke-WcUrl 'wc-cleanup-migration.php?key=ybb-migrate-20260624' | Out-Null
  }
}

Write-Host '=== Step 8/9: sync Woo -> products.json (wcId binding) ==='
node scripts/sync-from-wp.mjs --site $SiteUrl
if ($LASTEXITCODE -ne 0) { throw 'sync-from-wp failed' }

Write-Host '=== Step 9/9: build + deploy static site ==='
if ($SkipDeploy) {
  powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipSync -SkipDeploy
} else {
  powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipSync
}
if ($LASTEXITCODE -ne 0) { throw 'build-static failed' }

Write-Host ''
Write-Host '[pipeline] DONE'
Write-Host "Verify: $SiteUrl/ | $SiteUrl/cart/ | $SiteUrl/checkout/ | $SiteUrl/my-account/"
