# Start public temporary tunnel (Cloudflare trycloudflare) to ybb-site dev server.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/subdomain/start-public-tunnel.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/subdomain/start-public-tunnel.ps1 -Foreground
#
param(
  [switch]$Foreground,
  [int]$WaitSeconds = 45
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$SiteRoot = Split-Path (Split-Path $ScriptDir -Parent) -Parent
$ConfigFile = Join-Path $ScriptDir "subdomain.config.json"
$Cloudflared = Join-Path $ScriptDir "bin\cloudflared.exe"
$PidFile = Join-Path $ScriptDir "public-tunnel.pid"
$LogFile = Join-Path $ScriptDir "public-tunnel.log"
$UrlFile = Join-Path $ScriptDir "public-tunnel.url"

if (-not (Test-Path $ConfigFile)) {
  throw "Missing config: $ConfigFile"
}
if (-not (Test-Path $Cloudflared)) {
  throw "Missing cloudflared. Run: powershell -File scripts/subdomain/install-cloudflared.ps1"
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$target = $config.target
if (-not $target) { $target = "http://127.0.0.1:3000" }

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

function Stop-ExistingTunnel {
  if (Test-Path $PidFile) {
    $oldPid = (Get-Content $PidFile -Raw).Trim()
    if ($oldPid -match '^\d+$') {
      $proc = Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "[public-tunnel] Stopping existing tunnel PID $oldPid..."
        Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
      }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $UrlFile -Force -ErrorAction SilentlyContinue
}

function Get-TunnelUrlFromLog([string]$logPath) {
  if (-not (Test-Path $logPath)) { return $null }
  $text = Get-Content $logPath -Raw -ErrorAction SilentlyContinue
  if (-not $text) { return $null }
  if ($text -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
    return $Matches[1]
  }
  return $null
}

$targetPort = 3000
if ($target -match ':(\d+)(?:/|$)') { $targetPort = [int]$Matches[1] }

Write-Host "[public-tunnel] Site:   $SiteRoot"
Write-Host "[public-tunnel] Target: $target"

if (-not (Test-PortListening $targetPort)) {
  Write-Warning "[public-tunnel] Nothing listening on port $targetPort. Start dev server first:"
  Write-Warning "  powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1"
}

Stop-ExistingTunnel
Remove-Item $LogFile -Force -ErrorAction SilentlyContinue

if ($Foreground) {
  Write-Host "[public-tunnel] Running in foreground. Ctrl+C to stop."
  & $Cloudflared tunnel --url $target --no-autoupdate
  exit $LASTEXITCODE
}

$cfArgs = @(
  "tunnel",
  "--url", $target,
  "--no-autoupdate"
)
$argLine = ($cfArgs | ForEach-Object {
  if ($_ -match '\s') { "`"$_`"" } else { $_ }
}) -join " "
$cmd = "& `"$Cloudflared`" $argLine *>> `"$LogFile`""
$proc = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd) `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii
Write-Host "[public-tunnel] Starting cloudflared (PID $($proc.Id))..."

$deadline = (Get-Date).AddSeconds($WaitSeconds)
$url = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if ($proc.HasExited) {
    $tail = ""
    if (Test-Path $LogFile) { $tail = (Get-Content $LogFile -Tail 20) -join "`n" }
    throw "cloudflared exited early (code $($proc.ExitCode)). Log:`n$tail"
  }
  $url = Get-TunnelUrlFromLog $LogFile
  if ($url) { break }
}

if (-not $url) {
  $tail = ""
  if (Test-Path $LogFile) { $tail = (Get-Content $LogFile -Tail 30) -join "`n" }
  throw "Timed out waiting for trycloudflare URL. See log: $LogFile`n$tail"
}

Set-Content -Path $UrlFile -Value $url -Encoding ascii -NoNewline
Write-Host "[public-tunnel] Public URL: $url"
Write-Host "[public-tunnel] Log:  $LogFile"
Write-Host "[public-tunnel] Stop: powershell -File scripts/subdomain/stop-public-tunnel.ps1"
Write-Host "[public-tunnel] Note: URL changes each time you restart the tunnel."

