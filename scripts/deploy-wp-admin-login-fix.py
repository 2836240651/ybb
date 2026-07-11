#!/usr/bin/env python3
"""Deploy wp-admin login fix: mu-plugin + htaccess restore."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from deploy_ftps import _upload_file, connect_ftps, load_secrets


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote_root = ftp["remoteRoot"]
    client = connect_ftps(ftp)

    mu = ROOT / "deploy/wp-content/mu-plugins/ybb-wp-admin-login-fix.php"
    _upload_file(
        client,
        remote_root,
        mu,
        "wp-content/mu-plugins/ybb-wp-admin-login-fix.php",
    )
    client.quit()
    print("[deploy] uploaded ybb-wp-admin-login-fix.php")

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts/siteground_deploy_cli.py"), "restore-htaccess"],
        cwd=ROOT,
    )
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
