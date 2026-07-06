# Download cloudflared for Windows (trycloudflare quick tunnels).
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$binDir = Join-Path $ScriptDir "bin"
$out = Join-Path $binDir "cloudflared.exe"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
Write-Host "[public-tunnel] Downloading cloudflared..."
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
& $out --version
Write-Host "[public-tunnel] Installed: $out"
