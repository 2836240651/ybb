$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$stage = Join-Path $root "deploy/i18n-patch-stage"
$zip = Join-Path $root "deploy/i18n-patch-$stamp.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

# All HTML (script src + buildId comment must match new chunks)
Get-ChildItem -Path "out" -Filter "*.html" -Recurse | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path "out").Path.Length + 1)
  $dest = Join-Path $stage $rel
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $_.FullName $dest -Force
}

# New build manifests
$bid = if ((Get-Content "out/index.html" -Raw) -match '<!--([^>]+)-->') { $Matches[1] } else { throw "buildId not found" }
$mfSrc = Join-Path "out/_next/static" $bid
$mfDest = Join-Path $stage "_next/static/$bid"
New-Item -ItemType Directory -Path $mfDest -Force | Out-Null
Copy-Item (Join-Path $mfSrc "*") $mfDest -Force

# Chunks introduced by this build (vs prior manifest)
py -u scripts/pack-i18n-patch-list.py | ForEach-Object {
  if (-not $_) { return }
  $src = Join-Path "out" ($_ -replace '^/', '')
  if (-not (Test-Path $src)) { Write-Warning "missing $src"; return }
  $dest = Join-Path $stage ($_ -replace '^/', '')
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $src $dest -Force
}

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$stage/*" -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "[pack-i18n-patch] OK $zip ($sizeMb MB)"
Write-Host "[pack-i18n-patch] buildId=$bid"
