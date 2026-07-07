# 首次克隆后初始化 shopify-shangjia skill
$SkillRoot = $PSScriptRoot | Split-Path -Parent
Set-Location $SkillRoot

if (-not (Test-Path "config\store.json")) {
  Copy-Item "config\store.example.json" "config\store.json"
  Write-Host "已创建 config\store.json，请按店铺修改 store / locationId / collections"
}

New-Item -ItemType Directory -Force -Path "output\shopify\batches" | Out-Null

Set-Location "playwright"
if (-not (Test-Path "node_modules")) {
  npm install
}
Write-Host "Skill 根目录: $SkillRoot"
Write-Host "下一步: cd playwright; npm run open-chrome; node wait-capture-session.mjs"
