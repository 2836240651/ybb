# Stop temporary subdomain reverse proxy.
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$PidFile = Join-Path $ScriptDir "subdomain-proxy.pid"
$config = Get-Content (Join-Path $ScriptDir "subdomain.config.json") -Raw | ConvertFrom-Json
$proxyPort = [int]$config.proxyPort

if (Test-Path $PidFile) {
  $pidText = (Get-Content $PidFile -Raw).Trim()
  if ($pidText -match '^\d+$') {
    $proc = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "[subdomain] Stopping proxy PID $pidText..."
      Stop-Process -Id ([int]$pidText) -Force
    }
  }
  Remove-Item $PidFile -Force
}

$remaining = @()
try {
  $remaining = @(
    Get-NetTCPConnection -LocalPort $proxyPort -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
} catch { }

if (@($remaining).Count -gt 0) {
  Write-Warning "[subdomain] Port $proxyPort still in use (PIDs: $($remaining -join ', '))"
} else {
  Write-Host "[subdomain] Proxy stopped. Port $proxyPort is free."
}

Write-Host "[subdomain] To remove hosts entry, edit C:\Windows\System32\drivers\etc\hosts and delete line for $($config.subdomain)"
