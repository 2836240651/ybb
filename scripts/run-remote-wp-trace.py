#!/usr/bin/env python3
"""Run wp-admin trace on deploy machine (different IP, no local captcha bias)."""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "scripts/trace-wp-admin-http.py").read_text(encoding="utf-8")
SRC = SRC.replace(
    'ROOT = Path(__file__).resolve().parents[1]',
    'ROOT = Path("/opt/ybb-site")',
)
payload = base64.b64encode(SRC.encode()).decode()
cmd = f"echo {payload} | base64 -d > /tmp/trace-wp.py && cd /opt/ybb-site && python3 /tmp/trace-wp.py"
proc = subprocess.run(["ssh", "hermes-modx", cmd], capture_output=True, text=True)
sys.stdout.write(proc.stdout)
sys.stderr.write(proc.stderr)
sys.exit(proc.returncode)
