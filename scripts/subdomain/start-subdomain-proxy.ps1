# Start temporary subdomain reverse proxy for ybb-site dev server.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/subdomain/start-subdomain-proxy.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/subdomain/start-subdomain-proxy.ps1 -InstallHosts
#
param(
  [switch]$InstallHosts,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$SiteRoot = Split-Path (Split-Path $ScriptDir -Parent) -Parent
$ConfigFile = Join-Path $ScriptDir "subdomain.config.json"
$ProxyScript = Join-Path $ScriptDir "subdomain-proxy.mjs"
$PidFile = Join-Path $ScriptDir "subdomain-proxy.pid"
$LogFile = Join-Path $ScriptDir "subdomain-proxy.log"

if (-not (Test-Path $ConfigFile)) {
  throw "Missing config: $ConfigFile"
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$subdomain = $config.subdomain
$proxyPort = [int]$config.proxyPort
$target = $config.target
$targetPort = 3000
if ($target -match ':(\d+)(?:/|$)') { $targetPort = [int]$Matches[1] }

function Test-PortListening([int]$port) {
  $pids = @()
  try {
    $pids = @(
      Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    )
  } catch { }
  return @($pids | Where-Object { $_ -and $_ -gt 0 }).Count -gt 0
}

function Stop-ExistingProxy {
  if (Test-Path $PidFile) {
    $oldPid = Get-Content $PidFile -Raw
  if ($oldPid -match '^\d+$') {
      $proc = Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "[subdomain] Stopping existing proxy PID $oldPid..."
        Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
      }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Install-HostsEntry {
  $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
  $line = "127.0.0.1 $subdomain"
  $content = Get-Content $hostsPath -ErrorAction Stop
  $pattern = [regex]::Escape($subdomain)
  if ($content -match $pattern) {
    Write-Host "[subdomain] hosts already contains $subdomain"
    return
  }

  Write-Host "[subdomain] Adding hosts entry (admin required): $line"
  Add-Content -Path $hostsPath -Value "`n# ybb-site temporary dev subdomain`n$line" -Encoding ascii
  Write-Host "[subdomain] hosts updated."
}

Write-Host "[subdomain] Site:   $SiteRoot"
Write-Host "[subdomain] Target: $target"
Write-Host "[subdomain] URL:    http://${subdomain}:$proxyPort/"

if (-not (Test-PortListening $targetPort)) {
  Write-Warning "[subdomain] Nothing listening on port $targetPort. Start dev server first:"
  Write-Warning "  powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1"
}

Stop-ExistingProxy

if ($InstallHosts) {
  Install-HostsEntry
} else {
  Write-Host "[subdomain] hosts (manual, admin): 127.0.0.1 $subdomain"
  Write-Host "[subdomain] Or rerun with -InstallHosts to append automatically."
}

if ($Foreground) {
  Write-Host "[subdomain] Running in foreground. Ctrl+C to stop."
  node $ProxyScript
  exit $LASTEXITCODE
}

$cmd = "node `"$ProxyScript`" *>> `"$LogFile`""
$proc = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd) `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii
Start-Sleep -Seconds 1

if (-not (Test-PortListening $proxyPort)) {
  throw "Proxy failed to bind port $proxyPort. See log: $LogFile"
}

Write-Host "[subdomain] Proxy started (PID $($proc.Id))"
Write-Host "[subdomain] Log:  $LogFile"
Write-Host "[subdomain] Stop: powershell -File scripts/subdomain/stop-subdomain-proxy.ps1"
