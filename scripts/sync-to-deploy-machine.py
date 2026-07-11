#!/usr/bin/env python3
"""Sync full ybb-site source to Ubuntu deploy machine (/opt/ybb-site).

Standard production order (see AGENTS.md):
  1. Local build / review
  2. This script (deploy machine code + remote npm run build)
  3. SiteGround deploy (build-static.ps1 deploy step, WP Sync, or runner)
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("YBB_DEPLOY_HOST", "hermes-modx")
REMOTE_DIR = os.environ.get("YBB_REMOTE_DIR", "/opt/ybb-site")

EXCLUDES = [
    ".git",
    ".venv",
    ".next",
    "out",
    "node_modules",
    "secrets.local.json",
    "__pycache__",
    "reports",
    "audit-screenshots",
    "dev-server.pid",
    "deploy/remote-backup",
    "deploy/i18n-patch-stage",
    "deploy/siteground-upload",
    "deploy/siteground-upload-temp",
]

VERIFY_FILES = [
    "package.json",
    "lib/data/products.json",
    "scripts/ybb-deploy-runner.sh",
    "hooks",
]


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd))
    return subprocess.run(cmd, check=True, text=True, **kwargs)


def main() -> int:
    if not (ROOT / "package.json").exists():
        print(f"missing package.json under {ROOT}", file=sys.stderr)
        return 1

    exclude_args: list[str] = []
    for item in EXCLUDES:
        exclude_args.extend(["--exclude", item])

    tar_cmd = ["tar", "-cf", "-", *exclude_args, "."]
    ssh_cmd = ["ssh", HOST, f"mkdir -p {REMOTE_DIR} && cd {REMOTE_DIR} && tar -xf -"]

    print(f"Syncing {ROOT} -> {HOST}:{REMOTE_DIR}")
    tar = subprocess.Popen(tar_cmd, cwd=ROOT, stdout=subprocess.PIPE)
    assert tar.stdout is not None
    ssh = subprocess.Popen(ssh_cmd, stdin=tar.stdout)
    tar.stdout.close()
    ssh.wait()
    tar.wait()
    if tar.returncode != 0:
        print(f"tar failed: {tar.returncode}", file=sys.stderr)
        return tar.returncode or 1
    if ssh.returncode != 0:
        print(f"ssh tar extract failed: {ssh.returncode}", file=sys.stderr)
        return ssh.returncode or 1

    verify_cmd = " ; ".join(
        [
            f"test -f {REMOTE_DIR}/package.json",
            f"test -f {REMOTE_DIR}/lib/data/products.json",
            f"python3 - <<'PY'\nimport json\np='{REMOTE_DIR}/lib/data/products.json'\nprint('products', len(json.load(open(p))))\nPY",
        ]
    )
    run(["ssh", HOST, verify_cmd])

    print("Remote build starting...")
    run(
        [
            "ssh",
            HOST,
            f"cd {REMOTE_DIR} && npm run build",
        ],
        timeout=900,
    )
    print("Sync + remote build OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
