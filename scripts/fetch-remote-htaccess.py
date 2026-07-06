#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, download_if_exists, load_secrets

OUT = Path(__file__).resolve().parent / ".audit-output"
OUT.mkdir(parents=True, exist_ok=True)
ftp = load_secrets()["ftp"]
root = ftp["remoteRoot"].rstrip("/")
client = connect_ftps(ftp)
for name in [".htaccess", "index.php"]:
    safe = name.replace("/", "-").lstrip(".") or "htaccess"
    download_if_exists(client, root, name, OUT / f"remote-{safe}")
client.quit()
