import time
from pathlib import Path
from scripts.deploy_ftps import load_secrets, upload_file

root = Path('.').resolve()
files = sorted((root / 'out' / 'products').glob('tz-qz-*/master.webp'))
print(f'files={len(files)}')
if not files:
    raise SystemExit(1)

secrets = load_secrets()
ftp = secrets['ftp']
remote_root = ftp.get('remoteRoot', '').rstrip('/') or '/carp-ybb.com/public_html'

ok = 0
fail = 0
for idx, f in enumerate(files, 1):
    rel = f"products/{f.parent.name}/master.webp"
    uploaded = False
    for attempt in range(1, 4):
        try:
            upload_file(ftp, remote_root, f, rel)
            uploaded = True
            ok += 1
            print(f"[{idx}/{len(files)}] ok {rel}")
            break
        except Exception as e:
            print(f"[{idx}/{len(files)}] retry {attempt} {rel}: {e}")
            time.sleep(1.5 * attempt)
    if not uploaded:
        fail += 1

print(f'upload_done ok={ok} fail={fail}')
if fail:
    raise SystemExit(2)
