param(
  [Parameter(Mandatory = $true)][string]$Sku,
  [switch]$SkipDeploy,
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$YbbRoot = Split-Path $PSScriptRoot -Parent
$SkillRoot = Split-Path (Split-Path $YbbRoot -Parent) -Parent
$ManifestDir = Join-Path $YbbRoot "scripts\listings"
$Handle = $Sku.ToLower()
$Manifest = Join-Path $ManifestDir "$Handle-manifest.json"
$WpRoot = "D:\dev\独立站上架\wordpress"

if (-not (Test-Path $Manifest)) {
  throw "Missing manifest: $Manifest (create from agent JSON first)"
}

Write-Host "== Phase 1: Woo update $Sku ==" -ForegroundColor Cyan
Set-Location $WpRoot
node 22-update-existing-wc-v2-product.mjs --manifest $Manifest --sku $Sku
if ($LASTEXITCODE -ne 0) { throw "Woo update failed" }

Write-Host "== Phase 2: sync-from-wp ==" -ForegroundColor Cyan
Set-Location $YbbRoot
py scripts\sync-from-wp-playwright.py --fetch-variations
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Local sync-from-wp failed (often SiteGround captcha). Will rely on deploy-machine runner if deploying."
  if ($SkipDeploy) {
    throw "sync-from-wp failed and -SkipDeploy set — cannot verify products.json; fix sync or deploy via runner"
  }
}

Write-Host "== Phase 2 gate: products.json must contain $Handle ==" -ForegroundColor Cyan
$productsJson = Join-Path $YbbRoot "lib\data\products.json"
node -e "const p=require(process.argv[1]); const h=process.argv[2]; const row=p.find(x=>x.handle===h); if(!row){console.error('GATE FAIL: missing in products.json:',h); process.exit(1);} if(!row.collection){console.error('GATE FAIL: empty collection for',h); process.exit(1);} if(row.collection==='terminal-tackle'){console.error('GATE FAIL: deprecated collection terminal-tackle for',h); process.exit(1);} console.log('GATE OK',h,'collection=',row.collection,'wcId=',row.wcId);" $productsJson $Handle
if ($LASTEXITCODE -ne 0) {
  if ($SkipDeploy) { throw "products.json gate failed" }
  Write-Warning "products.json gate failed locally — deploy-machine runner must refresh Woo data"
}

if (-not $SkipDeploy) {
  Write-Host "== Phase 3: deploy machine + SiteGround ==" -ForegroundColor Cyan
  python scripts\sync-to-deploy-machine.py
  if ($LASTEXITCODE -ne 0) { throw "sync-to-deploy-machine failed" }
  ssh hermes-modx "bash /opt/ybb-site/scripts/ybb-deploy-runner.sh --force"
  if ($LASTEXITCODE -ne 0) { throw "deploy runner failed" }

  Write-Host "== Phase 3 gate: PDP must be live ==" -ForegroundColor Cyan
  $pdpCode = curl.exe -sS -o NUL -w "%{http_code}" "https://carp-ybb.com/products/$Handle.html"
  if ($pdpCode -ne "200") { throw "GATE FAIL: PDP https://carp-ybb.com/products/$Handle.html returned $pdpCode" }
  Write-Host "GATE OK PDP 200" -ForegroundColor Green
}

Write-Host "== Phase 4: REST + redirect audit ==" -ForegroundColor Cyan
$t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/$Handle`?_=$t" | Out-Null
py scripts\legacy-permalink-redirect-audit.py --sample 3
if ($LASTEXITCODE -ne 0) { Write-Warning "legacy redirect audit had issues" }

if (-not $SkipBrowser) {
  Write-Host "== Phase 4.4: browser PDP smoke ==" -ForegroundColor Cyan
  py scripts\product-gallery-acceptance.py --base https://carp-ybb.com --handles $Handle
  if ($LASTEXITCODE -ne 0) { throw "product-gallery-acceptance failed" }
}

Write-Host "DONE $Sku ($Handle)" -ForegroundColor Green
