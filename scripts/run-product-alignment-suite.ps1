param(
  [ValidateSet("quick", "full", "deploy")]
  [string]$Mode = "quick",
  [switch]$RefreshWooCache,
  [switch]$SkipPdp
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== Product alignment suite ($Mode) ==="

if ($RefreshWooCache -or $Mode -eq "full") {
  Write-Host "[1/5] Refresh Woo cache (Playwright)..."
  py -u scripts/sync-from-wp-playwright.py --fetch-variations --skip-sync
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "[1/5] Skip Woo cache refresh (use -RefreshWooCache or -Mode full)"
}

Write-Host "[2/5] Full catalog: products.json vs Woo cache (all SKUs)..."
py -u scripts/product-catalog-full-alignment-audit.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[3/5] wcId sample + add-item (product-sync-acceptance)..."
py -u scripts/product-sync-acceptance.py --cache-only --sample-size 20
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Mode -eq "deploy" -or $Mode -eq "full") {
  Write-Host "[4/5] Legacy permalink 301 sweep (489 URLs)..."
  py -u scripts/legacy-permalink-redirect-audit.py
  if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: legacy redirect audit failed (captcha?) — check report"
  }
} else {
  Write-Host "[4/5] Skip legacy 301 sweep (use -Mode deploy|full)"
}

if (-not $SkipPdp) {
  $perCol = if ($Mode -eq "full") { 0 } else { 2 }
  if ($Mode -eq "full") {
    Write-Host "[5/5] PDP browser vs Woo (ALL products — slow)..."
    py -u scripts/product-pdp-woo-alignment-audit.py --per-collection 9999
  } else {
    Write-Host "[5/5] PDP smoke: 2 per collection..."
    py -u scripts/product-pdp-woo-alignment-audit.py --per-collection 2
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: PDP audit had failures — see reports/product-pdp-woo-alignment.json"
  }
} else {
  Write-Host "[5/5] Skip PDP browser (-SkipPdp)"
}

Write-Host "=== Done. Reports under reports/ ==="
