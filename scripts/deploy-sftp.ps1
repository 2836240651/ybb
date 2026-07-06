param(
  [string]$SecretsPath = (Join-Path $PSScriptRoot "..\secrets.local.json"),
  [string]$OutDir = (Join-Path $PSScriptRoot "..\out"),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $SecretsPath)) { throw "Missing secrets: $SecretsPath" }
if (-not (Test-Path $OutDir)) { throw "Missing out dir. Run scripts/build-static.ps1 first." }

$secrets = Get-Content $SecretsPath -Raw | ConvertFrom-Json
$ftp = $secrets.ftp
if (-not $ftp) { throw "secrets.local.json missing ftp section" }

$hostName = $ftp.host
$user = $ftp.username
$pass = $ftp.password
$port = [int]($ftp.port)
$remoteRoot = $ftp.remoteRoot

Write-Host "[deploy-sftp] host=$hostName user=$user remote=$remoteRoot"

py -c @"
import json, os, sys, time
from pathlib import Path
import paramiko

secrets = json.loads(Path(r'$SecretsPath').read_text(encoding='utf-8'))
ftp = secrets['ftp']
out_dir = Path(r'$OutDir')
backup_dir = Path(r'$(Join-Path $PSScriptRoot "..\deploy\remote-backup")')
backup_dir.mkdir(parents=True, exist_ok=True)
dry_run = $(if ($DryRun) { 'True' } else { 'False' })

transport = paramiko.Transport((ftp['host'], int(ftp['port'])))
transport.connect(username=ftp['username'], password=ftp['password'])
sftp = paramiko.SFTPClient.from_transport(transport)

def download_if_exists(remote, local):
    try:
        sftp.stat(remote)
        sftp.get(remote, str(local))
        print(f'[backup] {remote} -> {local}')
        return True
    except FileNotFoundError:
        print(f'[skip-backup] missing {remote}')
        return False

stamp = time.strftime('%Y%m%d-%H%M%S')
for name in ['.htaccess', 'index.php', 'index.html']:
    download_if_exists(f"{ftp['remoteRoot']}/{name}", backup_dir / f"{stamp}-{name}")

def ensure_remote_dir(path):
    parts = [p for p in path.split('/') if p]
    cur = ''
    for part in parts:
        cur += '/' + part
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            if dry_run:
                print(f'[mkdir] {cur}')
            else:
                sftp.mkdir(cur)
                print(f'[mkdir] {cur}')

def upload_file(local_path, remote_path):
    if dry_run:
        print(f'[upload] {local_path} -> {remote_path}')
        return
    ensure_remote_dir(os.path.dirname(remote_path).replace('\\\\', '/'))
    sftp.put(str(local_path), remote_path)
    print(f'[upload] {remote_path}')

# htaccess merge upload
htaccess_snippet = Path(r'$(Join-Path $PSScriptRoot "..\deploy\htaccess.snippet")')
merged_local = backup_dir / f'{stamp}-htaccess.merged'
content = ''
backup_ht = backup_dir / f'{stamp}-.htaccess'
if backup_ht.exists():
    content = backup_ht.read_text(encoding='utf-8', errors='ignore') + '\n\n'
snippet = htaccess_snippet.read_text(encoding='utf-8')
if 'DirectoryIndex index.html' not in content:
    content = 'DirectoryIndex index.html index.php\n\n' + content
if '# --- Next.js static (ybb-site) ---' not in content:
    content += '\n# --- Next.js static (ybb-site) ---\n' + snippet
merged_local.write_text(content, encoding='utf-8')
upload_file(merged_local, f"{ftp['remoteRoot']}/.htaccess")

count = 0
for root, dirs, files in os.walk(out_dir):
    rel = os.path.relpath(root, out_dir).replace('\\\\', '/')
    if rel == '.':
        rel_prefix = ftp['remoteRoot']
    else:
        rel_prefix = f"{ftp['remoteRoot']}/{rel}"
    for fname in files:
        local = Path(root) / fname
        remote = f"{rel_prefix}/{fname}".replace('//', '/')
        upload_file(local, remote)
        count += 1

print(f'[deploy-sftp] done files={count} dry_run={dry_run}')
sftp.close()
transport.close()
"@
