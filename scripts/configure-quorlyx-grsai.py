#!/usr/bin/env python3
"""Configure Quorlyx Variation A: GRSAI via openai_compatible (grsaiapi.com/v1 + gpt-5.5)."""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_YAML = Path(r"D:/dev/workspace/scripts/_ssh-probe/payload/config.yaml")
MIGRATE_KEY = "ybb-migrate-20260624"

sys.path.insert(0, str(ROOT / "scripts"))
from deploy_ftps import load_secrets, upload_file  # noqa: E402


def parse_lyncr_yaml(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    in_lyncr = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^lyncr:\s*$", line):
            in_lyncr = True
            continue
        if in_lyncr and re.match(r"^[^\s#]", line) and not re.match(r"^\s", line):
            break
        if not in_lyncr:
            continue
        m = re.match(r"^\s+(url|api_key|model_chat):\s*(.+?)\s*(?:#.*)?$", line)
        if m:
            out[m.group(1)] = m.group(2).strip("\"'")
    return out


def main() -> int:
    lyncr = parse_lyncr_yaml(CONFIG_YAML)
    api_key = lyncr.get("api_key", "")
    model = lyncr.get("model_chat", "gpt-5.5")
    base_url = (lyncr.get("url", "https://grsaiapi.com") or "").rstrip("/")
    if base_url and not base_url.endswith("/v1"):
        base_url = f"{base_url}/v1"

    if not api_key:
        print("No lyncr.api_key in config.yaml", file=sys.stderr)
        return 1

    secrets = load_secrets()
    ftp = secrets["ftp"]
    remote_root = ftp["remoteRoot"]
    site_url = secrets.get("wordpress", {}).get("siteUrl", "https://carp-ybb.com")

    config_path = ROOT / "deploy" / "quorlyx-setup-config.json"
    config_path.write_text(
        json.dumps(
            {
                "api_key": api_key,
                "model": model,
                "base_url": base_url,
                "provider": "openai_compatible",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"[config] provider=openai_compatible model={model} base_url={base_url}")
    upload_file(ftp, remote_root, ROOT / "deploy" / "setup-quorlyx.php", "setup-quorlyx.php")
    upload_file(ftp, remote_root, config_path, "quorlyx-setup-config.json")

    url = f"{site_url.rstrip('/')}/setup-quorlyx.php?key={MIGRATE_KEY}&apply=1&nocache=1"
    with urllib.request.urlopen(url, timeout=120) as resp:
        body = resp.read().decode("utf-8")
    print(body)
    result = json.loads(body)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
