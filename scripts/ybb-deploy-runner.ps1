# YBB Site Manager — external deploy runner (Phase 3 + Product Ops S4)
param(
    [switch]$Poll,
    [switch]$Local,
    [switch]$Force,
    [int]$IntervalSec = 300,
    [string]$Site = "https://carp-ybb.com"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-Secrets {
    $path = Join-Path $Root "secrets.local.json"
    if (-not (Test-Path $path)) {
        throw "Missing secrets.local.json — set deploy.runnerKey"
    }
    return Get-Content $path -Raw | ConvertFrom-Json
}

function Get-LocalBuildId {
    $indexPath = Join-Path $Root "out/index.html"
    if (-not (Test-Path $indexPath)) { return "" }
    $html = Get-Content $indexPath -Raw
    if ($html -match '<!--([^>]+)-->') {
        return $Matches[1]
    }
    return ""
}

function Get-ProductDeployMeta {
    $productsPath = Join-Path $Root "lib/data/products.json"
    if (-not (Test-Path $productsPath)) {
        return @{ productCount = 0; productHandles = @() }
    }
    $products = Get-Content $productsPath -Raw | ConvertFrom-Json
    $handles = @($products | ForEach-Object { [string]$_.handle } | Where-Object { $_ })
    return @{
        productCount = $handles.Count
        productHandles = $handles
    }
}

function Invoke-YbbRest {
    param(
        [string]$Route,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [string]$Key
    )
    $base = "$Site/index.php"
    $qs = [System.Web.HttpUtility]::ParseQueryString("")
    $qs["rest_route"] = $Route
    $qs["_"] = [string][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $uri = "$base`?$($qs.ToString())"
    if ($Route -eq "/ybb/v1/deploy/status") {
        $uri = "$uri&pending=1"
    }
    $headers = @{ "X-YBB-Deploy-Key" = $Key }
    if ($Method -eq "GET") {
        return Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
    }
    return Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body ($Body | ConvertTo-Json -Depth 8) -ContentType "application/json"
}

function Invoke-DeployStep {
    param(
        [string]$Step,
        [string]$Label,
        [string]$Key
    )
    if (-not $Key) { return }
    try {
        Invoke-YbbRest -Route "/ybb/v1/deploy/step" -Method POST -Key $Key -Body @{
            step  = $Step
            label = $Label
        } | Out-Null
    }
    catch {
        Write-Host ('[runner] step log skipped: ' + $_.Exception.Message)
    }
}

function Run-PipelineCore {
    param([string]$Key = "")

    Invoke-DeployStep -Step "sync" -Label "正在从 WooCommerce 同步产品数据 (Playwright)..." -Key $Key
    Write-Host '[runner] sync-from-wp-playwright'
    py -u scripts/sync-from-wp-playwright.py --site $Site --fetch-variations
    if ($LASTEXITCODE -ne 0) { throw "sync-from-wp-playwright failed" }

    Invoke-DeployStep -Step "variations" -Label "正在对齐变体 wcId..." -Key $Key
    Write-Host '[runner] fix-variation-ids-playwright'
    py -u scripts/fix-variation-ids-playwright.py
    if ($LASTEXITCODE -ne 0) { throw "fix-variation-ids-playwright failed" }

    Invoke-DeployStep -Step "accept" -Label "正在验收 wcId / add-item 漂移..." -Key $Key
    Write-Host '[runner] product-sync-acceptance (pre-deploy)'
    py -u scripts/product-sync-acceptance.py --site $Site --cache-only
    if ($LASTEXITCODE -ne 0) { throw "product-sync-acceptance blocked deploy" }

    Invoke-DeployStep -Step "build" -Label "正在构建静态站..." -Key $Key
    Write-Host '[runner] build-static'
    powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipSync -SkipDeploy
    if ($LASTEXITCODE -ne 0) { throw "build-static failed" }

    Invoke-DeployStep -Step "audit" -Label "正在审计部署包..." -Key $Key
    Write-Host '[runner] audit'
    py -u scripts/audit-deploy-package.py
    if ($LASTEXITCODE -ne 0) { throw "audit BLOCKED" }

    Invoke-DeployStep -Step "upload" -Label "正在上传静态文件 (SiteGround zip)..." -Key $Key
    Write-Host '[runner] deploy-siteground-browser'
    powershell -ExecutionPolicy Bypass -File scripts/deploy-siteground-browser.ps1 -SkipBuild -AutoUpload
    if ($LASTEXITCODE -ne 0) { throw "deploy-siteground-browser failed" }

    Invoke-DeployStep -Step "verify" -Label "正在验证远程 buildId 与资产..." -Key $Key
    Write-Host '[runner] verify-remote-deploy'
    py -u scripts/verify-remote-deploy.py
    if ($LASTEXITCODE -ne 0) { throw "verify-remote-deploy failed" }

    Write-Host '[runner] product-sync-acceptance (post-deploy)'
    py -u scripts/product-sync-acceptance.py --site $Site --post-deploy
    if ($LASTEXITCODE -ne 0) { throw "post-deploy product acceptance failed" }
}

function Complete-Deploy {
    param(
        [string]$Key,
        [string]$State,
        [string]$BuildId = "",
        [string]$ErrorMsg = ""
    )
    if (-not $Key) { return }
    $body = @{
        state = $State
        buildId = $BuildId
        error = $ErrorMsg
    }
    if ($State -eq "success") {
        $meta = Get-ProductDeployMeta
        $body.productCount = $meta.productCount
        $body.productHandles = $meta.productHandles
    }
    Invoke-YbbRest -Route "/ybb/v1/deploy/complete" -Method POST -Key $Key -Body $body
}

function Run-DeployPipeline {
    param([string]$Key)

    Write-Host '[runner] claim job'
    $claim = Invoke-YbbRest -Route "/ybb/v1/deploy/claim" -Method POST -Key $Key
    if (-not $claim.claimed) {
        Write-Host '[runner] nothing to claim (queue idle — use -Force or trigger in WP admin)'
        return
    }

    try {
        Run-PipelineCore -Key $Key
        $buildId = Get-LocalBuildId
        Complete-Deploy -Key $Key -State "success" -BuildId $buildId
        $meta = Get-ProductDeployMeta
        Write-Host ('[runner] success buildId=' + $buildId + ' products=' + $meta.productCount)
    }
    catch {
        $msg = $_.Exception.Message
        Write-Host ('[runner] failed: ' + $msg)
        Complete-Deploy -Key $Key -State "failed" -ErrorMsg $msg
        throw
    }
}

function Run-ForcePipeline {
    param([string]$Key)

    Write-Host '[runner] force pipeline (skip claim, REST complete enabled)'
    try {
        Run-PipelineCore -Key $Key
        $buildId = Get-LocalBuildId
        Complete-Deploy -Key $Key -State "success" -BuildId $buildId
        $meta = Get-ProductDeployMeta
        Write-Host ('[runner] force success buildId=' + $buildId + ' products=' + $meta.productCount)
    }
    catch {
        $msg = $_.Exception.Message
        Write-Host ('[runner] failed: ' + $msg)
        Complete-Deploy -Key $Key -State "failed" -ErrorMsg $msg
        throw
    }
}

function Check-And-Run {
    $secrets = Get-Secrets
    $key = $secrets.deploy.runnerKey
    if (-not $key) { throw "secrets.local.json missing deploy.runnerKey" }

    $status = Invoke-YbbRest -Route "/ybb/v1/deploy/status" -Method GET -Key $key
    if ($status.readyToRun -or $status.pending) {
        Run-DeployPipeline -Key $key
    }
    else {
        Write-Host ('[runner] idle state=' + $status.state + ' pending=' + $status.pending)
        Write-Host '[runner] tip: WP admin trigger deploy, or run with -Force'
    }
}

Add-Type -AssemblyName System.Web
if ($Local) {
    Write-Host '[runner] local pipeline (no deploy queue REST)'
    Run-PipelineCore
    $buildId = Get-LocalBuildId
    $meta = Get-ProductDeployMeta
    Write-Host ('[runner] local success buildId=' + $buildId + ' products=' + $meta.productCount)
}
elseif ($Force) {
    $secrets = Get-Secrets
    $key = $secrets.deploy.runnerKey
    if (-not $key) { throw "secrets.local.json missing deploy.runnerKey" }
    Run-ForcePipeline -Key $key
}
elseif ($Poll) {
    while ($true) {
        Check-And-Run
        Start-Sleep -Seconds $IntervalSec
    }
}
else {
    Check-And-Run
}
