#!/usr/bin/env python3
"""Upload patched Quorlyx to carp-ybb WP plugins and run setup-quorlyx.php."""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVERSE_SKILL = ROOT.parents[1]
QUORLYX_SRC = REVERSE_SKILL / "vendor" / "quorlyx"
SECRETS = ROOT / "secrets.local.json"
CONFIG_YAML = Path(r"D:/dev/workspace/scripts/_ssh-probe/payload/config.yaml")
SETUP_PHP = ROOT / "deploy" / "setup-quorlyx.php"
MIGRATE_KEY = "ybb-migrate-20260624"
REMOTE_PLUGIN_PREFIX = "wp-content/plugins/quorlyx"

sys.path.insert(0, str(ROOT / "scripts"))
from deploy_ftps import connect_ftps, cwd_to, ensure_remote_dir, load_secrets  # noqa: E402


def parse_lyncr_yaml(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
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


SKIP_PREFIXES = (
    "docs/media/",
    ".github/",
)
MAX_FILE_BYTES = 2 * 1024 * 1024


def should_upload(rel: str, size: int) -> bool:
    rel = rel.replace("\\", "/")
    for prefix in SKIP_PREFIXES:
        if rel.startswith(prefix):
            return False
    if size > MAX_FILE_BYTES:
        return False
    return True


def upload_tree(ftp_cfg: dict, remote_root: str, local_root: Path, remote_prefix: str) -> int:
    count = 0
    files = sorted(p for p in local_root.rglob("*") if p.is_file())
    priority = [p for p in files if p.name == "quorlyx.php"]
    rest = [p for p in files if p.name != "quorlyx.php"]
    ordered = priority + rest

    client = None

    def get_client():
        nonlocal client
        if client is not None:
            return client
        for attempt in range(5):
            try:
                client = connect_ftps(ftp_cfg)
                return client
            except Exception as err:
                print(f"[ftp] connect retry {attempt + 1}: {err}", file=sys.stderr)
                time.sleep(3 * (attempt + 1))
        raise RuntimeError("Could not connect FTPS")

    def reset_client():
        nonlocal client
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass
        client = None

    try:
        for path in ordered:
            rel = path.relative_to(local_root).as_posix()
            if rel.startswith(".git/") or rel == ".git":
                continue
            size = path.stat().st_size
            if not should_upload(rel, size):
                print(f"[skip] {rel} ({size} bytes)")
                continue
            remote_rel = f"{remote_prefix}/{rel}".replace("\\", "/")
            rel_dir = str(Path(remote_rel).parent).replace("\\", "/")
            fname = Path(remote_rel).name

            for attempt in range(3):
                try:
                    c = get_client()
                    ensure_remote_dir(c, remote_root, rel_dir)
                    with path.open("rb") as fh:
                        c.storbinary(f"STOR {fname}", fh, blocksize=8192)
                    print(f"[upload] {remote_rel} ({size} bytes)")
                    count += 1
                    break
                except Exception as err:
                    print(f"[retry] {remote_rel} attempt {attempt + 1}: {err}", file=sys.stderr)
                    reset_client()
                    time.sleep(2 * (attempt + 1))
            else:
                raise RuntimeError(f"Failed to upload {remote_rel}")
    finally:
        reset_client()
    return count


def run_setup(site_url: str, api_key: str, model: str, base_url: str) -> dict:
    url = (
        f"{site_url.rstrip('/')}/setup-quorlyx.php"
        f"?key={MIGRATE_KEY}&apply=1&nocache=1"
    )
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    if not QUORLYX_SRC.is_dir():
        print(f"Missing Quorlyx source: {QUORLYX_SRC}", file=sys.stderr)
        return 1
    if not SECRETS.is_file():
        print(f"Missing secrets: {SECRETS}", file=sys.stderr)
        return 1

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

    print("[deploy] Waiting 15s for FTPS connection slots...")
    time.sleep(15)

    print(f"[deploy] Uploading Quorlyx from {QUORLYX_SRC}")
    n = upload_tree(ftp, remote_root, QUORLYX_SRC, REMOTE_PLUGIN_PREFIX)
    print(f"[deploy] Uploaded {n} plugin files")

    print("[deploy] Uploading setup-quorlyx.php + config")
    config_path = ROOT / "deploy" / "quorlyx-setup-config.json"
    config_path.write_text(
        json.dumps(
            {"api_key": api_key, "model": model, "base_url": base_url},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    from deploy_ftps import upload_file

    upload_file(ftp, remote_root, SETUP_PHP, "setup-quorlyx.php")
    upload_file(ftp, remote_root, config_path, "quorlyx-setup-config.json")

    print("[deploy] Activating + configuring Variation A (lyncr)")
    try:
        result = run_setup(site_url, api_key, model, "")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"Setup HTTP {e.code}: {body}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, ensure_ascii=False))
    if not result.get("ok"):
        return 1

    print("[deploy] Done. Remove setup-quorlyx.php from public_html when verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
