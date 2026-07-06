param(
  [string]$SiteUrl = "https://carp-ybb.com",
  [switch]$SkipSync,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:NEXT_PUBLIC_SITE_URL = $SiteUrl
Write-Host "[build-static] NEXT_PUBLIC_SITE_URL=$SiteUrl"

if (-not $SkipSync) {
  Write-Host "[build-static] sync-from-wp-playwright (Woo cache)..."
  py -u scripts/sync-from-wp-playwright.py --fetch-variations
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "[build-static] sync-from-wp (apply Woo -> products.json)..."
  node scripts/sync-from-wp.mjs --site $SiteUrl --woo-cache reports/woo-store-products-cache.json --fetch-variations
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "[build-static] generate permalink + variant redirects..."
node scripts/generate-variant-redirects.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[build-static] npm run build..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[build-static] prune stale legacy PDP html..."
node scripts/prune-stale-product-html.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path "out/index.html")) {
  Write-Error "out/index.html missing — static export failed"
}

$archive = Join-Path $root "deploy/ybb-static-export.zip"
if (Test-Path $archive) { Remove-Item $archive -Force }
# Compress-Archive can intermittently fail on Windows due to transient file locks (indexer/AV).
$maxAttempts = 5
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  try {
    if (Test-Path $archive) { Remove-Item $archive -Force -ErrorAction SilentlyContinue }
    Compress-Archive -Path "out/*" -DestinationPath $archive -Force
    break
  } catch {
    if ($attempt -ge $maxAttempts) { throw }
    Write-Host "[build-static] zip retry $attempt/${maxAttempts}: $($_.Exception.Message)"
    Start-Sleep -Seconds (2 * $attempt)
  }
}

Write-Host "[build-static] OK: out/ and $archive"

if (-not $SkipDeploy) {
  Write-Host "[build-static] deploy-siteground-browser..."
  powershell -ExecutionPolicy Bypass -File scripts/deploy-siteground-browser.ps1 -SkipBuild
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
