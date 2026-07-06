# Stop public trycloudflare tunnel.
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$PidFile = Join-Path $ScriptDir "public-tunnel.pid"
$UrlFile = Join-Path $ScriptDir "public-tunnel.url"

if (Test-Path $PidFile) {
  $pidText = (Get-Content $PidFile -Raw).Trim()
  if ($pidText -match '^\d+$') {
    $proc = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "[public-tunnel] Stopping tunnel PID $pidText..."
      Stop-Process -Id ([int]$pidText) -Force
    }
  }
  Remove-Item $PidFile -Force
}

# cloudflared may spawn child processes; stop any cloudflared from our bin still running
$bin = Join-Path $ScriptDir "bin\cloudflared.exe"
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $bin) } |
  ForEach-Object {
    Write-Host "[public-tunnel] Stopping cloudflared PID $($_.ProcessId)..."
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Remove-Item $UrlFile -Force -ErrorAction SilentlyContinue
Write-Host "[public-tunnel] Tunnel stopped."
