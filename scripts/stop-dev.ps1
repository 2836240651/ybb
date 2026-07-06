# Stop detached dev server (by port and/or saved PID file).
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/stop-dev.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/stop-dev.ps1 -Port 3000

param(
  [int]$Port = 3000
)

$SiteRoot = Split-Path $PSScriptRoot -Parent
$PidFile = Join-Path $SiteRoot "dev-server.pid"

function Get-ListenersOnPort([int]$listenPort) {
  $pids = @()
  try {
    $pids = @(
      Get-NetTCPConnection -LocalPort $listenPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    )
  } catch {}

  if ($pids.Count -eq 0) {
    $line = netstat -ano | Select-String ":$listenPort\s"
    foreach ($row in $line) {
      if ($row -match "\s+(\d+)\s*$") { $pids += [int]$Matches[1] }
    }
    $pids = $pids | Select-Object -Unique
  }

  return $pids | Where-Object { $_ -and $_ -gt 0 }
}

$targets = [System.Collections.Generic.HashSet[int]]::new()

if (Test-Path $PidFile) {
  $saved = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($saved -match "^\d+$") { [void]$targets.Add([int]$saved) }
}

foreach ($procId in (Get-ListenersOnPort $Port)) {
  [void]$targets.Add($procId)
}

if ($targets.Count -eq 0) {
  Write-Host "[dev] Nothing listening on port $Port."
  if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
  exit 0
}

foreach ($procId in $targets) {
  if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { continue }
  $name = (Get-Process -Id $procId).ProcessName
  if ($name -notin @("node", "nodejs")) {
    Write-Warning "[dev] Skip PID $procId ($name) — not node"
    continue
  }
  try {
    & taskkill.exe /F /T /PID $procId 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Stop-Process -Id $procId -Force -ErrorAction Stop
    }
    Write-Host "[dev] Stopped PID $procId ($name)"
  } catch {
    Write-Warning "[dev] PID $procId not running."
  }
}

if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
Write-Host "[dev] Port $Port released."
