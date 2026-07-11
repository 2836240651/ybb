#!/usr/bin/env python3
"""Push entire deploy/wp-content/mu-plugins tree to Ubuntu deploy machine."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = "hermes-modx"
REMOTE = "/opt/ybb-site/deploy/wp-content/mu-plugins"
LOCAL = ROOT / "deploy/wp-content/mu-plugins"


def main() -> int:
    if not LOCAL.is_dir():
        print(f"missing {LOCAL}", file=sys.stderr)
        return 1

    files = sorted(p for p in LOCAL.rglob("*") if p.is_file())
    print(f"pushing {len(files)} files -> {HOST}:{REMOTE}")
    for path in files:
        rel = path.relative_to(LOCAL).as_posix()
        remote = f"{REMOTE}/{rel}"
        remote_dir = remote.rsplit("/", 1)[0]
        subprocess.run(["ssh", HOST, f"mkdir -p {remote_dir}"], check=True)
        with path.open("rb") as fh:
            proc = subprocess.Popen(["ssh", HOST, f"cat > {remote}"], stdin=subprocess.PIPE)
            assert proc.stdin is not None
            proc.stdin.write(fh.read())
            proc.stdin.close()
            code = proc.wait()
            if code != 0:
                return code
        print(f"+ {rel} ({path.stat().st_size}b)")

    verify = (
        "grep \"'ja' =>\" /opt/ybb-site/deploy/wp-content/mu-plugins/ybb-locale.php | head -1"
    )
    subprocess.run(["ssh", HOST, verify], check=True)
    print("deploy machine mu-plugins mirror OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
