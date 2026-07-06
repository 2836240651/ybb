# Reset local + remote static catalog. Woo products should already be empty in wp-admin.
param(
  [switch]$DryRun,
  [switch]$SkipDeploy,
  [switch]$SkipRemote
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$root = Get-Location

Write-Host "[cleanup] Step 1/5: verify WooCommerce store API product count"
$wc = node -e "fetch('https://carp-ybb.com/index.php?rest_route=/wc/store/v1/products&per_page=1&page=1').then(r=>r.json()).then(j=>console.log(Array.isArray(j)?j.length:0)).catch(()=>console.log('ERR'))"
Write-Host "[cleanup] Woo store API products: $wc"

Write-Host "[cleanup] Step 2/5: clear local static product data"
if (-not $DryRun) {
  node -e "const fs=require('fs');const p='lib/data';fs.writeFileSync(p+'/products.json','[]\n');fs.writeFileSync(p+'/hot-products.json',JSON.stringify({handles:[]},null,2)+'\n');const cols=JSON.parse(fs.readFileSync(p+'/collections.json','utf8'));for(const c of cols){c.productCount=0;c.productHandles=[];}fs.writeFileSync(p+'/collections.json',JSON.stringify(cols,null,2)+'\n');console.log('local json cleared');"

  foreach ($dir in @("public/products", "out/products")) {
    if (Test-Path $dir) {
      Remove-Item -Recurse -Force $dir
      New-Item -ItemType Directory -Path $dir | Out-Null
      Write-Host "[cleanup] cleared $dir"
    }
  }
}

Write-Host "[cleanup] Step 3/5: remove remote static product pages/images"
if (-not $SkipRemote) {
  if ($DryRun) {
    py scripts/cleanup-remote-product-static.py --dry-run
  } else {
    py scripts/cleanup-remote-product-static.py
  }
  if ($LASTEXITCODE -ne 0) { throw "remote cleanup failed" }
}

Write-Host "[cleanup] Step 4/5: rebuild static site (empty catalog)"
if (-not $DryRun) {
  powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipSync -SkipDeploy
  if ($LASTEXITCODE -ne 0) { throw "build failed" }
}

Write-Host "[cleanup] Step 5/5: deploy empty catalog"
if (-not $DryRun -and -not $SkipDeploy) {
  py scripts/deploy_ftps.py --dry-run
  py scripts/deploy_ftps.py
  if ($LASTEXITCODE -ne 0) { throw "deploy failed" }
}

Write-Host "[cleanup] Done. Re-import from 产品表单.xlsx when ready:"
Write-Host "  py scripts/parse-product-form.py --xlsx `"$env:USERPROFILE\Desktop\产品表单.xlsx`""
Write-Host "  node scripts/export-product-images.mjs --all"
Write-Host "  node scripts/sync-from-wp.mjs"
Write-Host "  powershell -File scripts/build-static.ps1"
