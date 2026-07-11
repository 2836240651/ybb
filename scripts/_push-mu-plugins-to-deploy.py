#!/usr/bin/env python3
"""Push selected mu-plugin files to Ubuntu deploy machine (source mirror only)."""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = "hermes-modx"
REMOTE_ROOT = "/opt/ybb-site"

FILES = [
    "deploy/wp-content/mu-plugins/ybb-home-settings.php",
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/home.php",
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/blog.php",
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-sanitize.php",
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php",
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php",
]


def push_file(rel: str) -> None:
    local = ROOT / rel
    if not local.is_file():
        raise FileNotFoundError(local)
    remote = f"{REMOTE_ROOT}/{rel.replace(chr(92), '/')}"
    remote_dir = remote.rsplit("/", 1)[0]
    print("+", rel, f"({local.stat().st_size} bytes)")
    subprocess.run(["ssh", HOST, f"mkdir -p {remote_dir}"], check=True)
    with local.open("rb") as fh:
        proc = subprocess.Popen(["ssh", HOST, f"cat > {remote}"], stdin=subprocess.PIPE)
        assert proc.stdin is not None
        proc.stdin.write(fh.read())
        proc.stdin.close()
        code = proc.wait()
        if code != 0:
            raise subprocess.CalledProcessError(code, ["ssh", HOST, f"cat > {remote}"])


def main() -> int:
    for rel in FILES:
        push_file(rel)
    verify = (
        "wc -c /opt/ybb-site/deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/home.php; "
        "grep -c ybb_sm_home_sync_blog_latest_stories_flag "
        "/opt/ybb-site/deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/home.php"
    )
    subprocess.run(["ssh", HOST, verify], check=True)
    print("deploy machine mu-plugin mirror OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
