#!/usr/bin/env python3
"""Upload and run wp-admin login diagnose on deploy machine."""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "scripts/diagnose-wp-admin-login.py").read_text(encoding="utf-8")
SRC = SRC.replace(
    "ROOT = Path(__file__).resolve().parents[1]",
    'ROOT = Path("/opt/ybb-site")',
)
payload = base64.b64encode(SRC.encode()).decode()
cmd = f"echo {payload} | base64 -d > /tmp/diag.py && cd /opt/ybb-site && python3 /tmp/diag.py"
proc = subprocess.run(["ssh", "hermes-modx", cmd], capture_output=True, text=True)
sys.stdout.write(proc.stdout)
sys.stderr.write(proc.stderr)
sys.exit(proc.returncode)
