# Restart Next.js dev server on a clean port (survives closing Cursor terminal).
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1 -Port 3001
#   powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1 -Foreground
#
param(
  [int]$Port = 3000,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"
$SiteRoot = Split-Path $PSScriptRoot -Parent
$LogFile = Join-Path $SiteRoot "dev-server.log"
$PidFile = Join-Path $SiteRoot "dev-server.pid"

function Get-ListenersOnPort([int]$listenPort) {
  $pids = @()
  try {
    $pids = @(
      Get-NetTCPConnection -LocalPort $listenPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    )
  } catch {
    # fallback
  }

  if ($pids.Count -eq 0) {
    $line = netstat -ano | Select-String ":$listenPort\s" | Select-Object -First 20
    foreach ($row in $line) {
      if ($row -match "\s+(\d+)\s*$") {
        $pids += [int]$Matches[1]
      }
    }
    $pids = $pids | Select-Object -Unique
  }

  return $pids | Where-Object { $_ -and $_ -gt 0 }
}

function Test-DevServerProcess([int]$procId) {
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  return $proc.ProcessName -in @("node", "nodejs")
}

function Stop-PortListeners([int]$listenPort) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    $pids = Get-ListenersOnPort $listenPort | Where-Object { Test-DevServerProcess $_ }
    if (-not $pids -or @($pids).Count -eq 0) {
      $foreign = Get-ListenersOnPort $listenPort | Where-Object { -not (Test-DevServerProcess $_) }
      if (@($foreign).Count -gt 0) {
        throw "Port $listenPort is used by non-node process (PIDs: $($foreign -join ', ')). Change port: -Port 3001"
      }
      Write-Host "[dev] Port $listenPort is free."
      return
    }

    foreach ($procId in $pids) {
      try {
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "[dev] Stopping PID $procId ($name) on port $listenPort..."
        & taskkill.exe /F /T /PID $procId 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
          Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
      } catch {
        Write-Warning "[dev] Could not stop PID ${procId}: $_"
      }
    }

    Start-Sleep -Seconds 2
  }

  $remaining = Get-ListenersOnPort $listenPort | Where-Object { Test-DevServerProcess $_ }
  if (@($remaining).Count -gt 0) {
    throw "Port $listenPort still in use by node (PIDs: $($remaining -join ', ')). Run: scripts/stop-dev.ps1"
  }

  Write-Host "[dev] Port $listenPort cleared."
}

function Start-DevServer([string]$root, [int]$listenPort, [bool]$runForeground) {
  if (-not (Test-Path (Join-Path $root "package.json"))) {
    throw "package.json not found in $root"
  }

  $env:PORT = "$listenPort"

  if ($runForeground) {
    Write-Host "[dev] Starting in foreground: http://localhost:$listenPort"
    Write-Host "[dev] Press Ctrl+C to stop."
    Set-Location $root
    npm run dev -- -p $listenPort
    return
  }

  $cmd = @"
Set-Location '$root'
`$env:PORT = '$listenPort'
npm run dev -- -p $listenPort *>> '$LogFile'
"@

  $proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd) `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -Path $PidFile -Value $proc.Id -Encoding ascii

  Write-Host "[dev] Started detached (PID $($proc.Id))"
  Write-Host "[dev] URL:  http://localhost:$listenPort"
  Write-Host "[dev] Log:  $LogFile"
  Write-Host "[dev] PID:  $PidFile"
  Write-Host "[dev] Stop: powershell -File scripts/stop-dev.ps1 -Port $listenPort"
}

Write-Host "[dev] Site: $SiteRoot"
Stop-PortListeners -listenPort $Port
Start-DevServer -root $SiteRoot -listenPort $Port -runForeground:$Foreground.IsPresent
