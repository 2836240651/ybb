<#
.SYNOPSIS
  After bulk delist / Woo publish changes: sync Woo -> products.json, rebuild static out/, deploy.

.DESCRIPTION
  Pipeline (Layer A static catalog aligns with Woo publish):
    1. sync-from-wp-playwright.py  — fetch Woo Store API cache
    2. sync-from-wp.mjs            — write lib/data/products.json + collections.json
    3. generate-variant-redirects.mjs
    4. npm run build               — SSG + out/
    5. prune-stale-product-html.mjs
    6. deploy-siteground-browser.ps1 (optional)
    7. verify-remote-deploy.py     (optional)

  Run AFTER wc-keep-only-publish.php + ybb-keep-only-front-visible.php on production.

.EXAMPLE
  Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
  powershell -ExecutionPolicy Bypass -File scripts\run-catalog-rebuild.ps1

.EXAMPLE
  # Build only, no deploy
  powershell -ExecutionPolicy Bypass -File scripts\run-catalog-rebuild.ps1 -SkipDeploy
#>
param(
  [string]$SiteUrl = "https://carp-ybb.com",
  [switch]$SkipDeploy,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "=== YBB catalog rebuild (Woo -> static) ===" -ForegroundColor Cyan
Write-Host "Site: $SiteUrl"
Write-Host ""
Write-Host "Prerequisites (production, manual):" -ForegroundColor Yellow
Write-Host "  1. wc-keep-only-publish.php?key=...&dry_run=1  -> kept: 5"
Write-Host "  2. wc-keep-only-publish.php?key=...             -> apply"
Write-Host "  3. ybb-keep-only-front-visible.php (optional Layer C)"
Write-Host ""

$buildArgs = @("-SiteUrl", $SiteUrl)
if ($SkipDeploy) {
  $buildArgs += "-SkipDeploy"
}

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-static.ps1") @buildArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$productCount = 0
$productsPath = Join-Path $root "lib\data\products.json"
if (Test-Path $productsPath) {
  try {
    $json = Get-Content $productsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($json -is [System.Array]) {
      $productCount = $json.Count
    } elseif ($null -ne $json) {
      $productCount = 1
    }
  } catch {
    Write-Host "[run-catalog-rebuild] warn: could not parse products.json" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "[run-catalog-rebuild] products.json count: $productCount" -ForegroundColor Green

if (-not $SkipDeploy -and -not $SkipVerify) {
  Write-Host "[run-catalog-rebuild] verify-remote-deploy..."
  py scripts\verify-remote-deploy.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Done. Empty collection pages should now match static catalog." -ForegroundColor Green
Write-Host "Next: WP Site Manager -> Hot Products / Featured -> whitelist handles only."
