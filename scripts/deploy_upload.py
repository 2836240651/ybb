#!/usr/bin/env python3
"""Shared helpers for incremental static deploy."""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "out"
HTACCESS_SNIPPET = ROOT / "deploy" / "htaccess.snippet"
BACKUP_DIR = ROOT / "deploy" / "remote-backup"
MANIFEST_PATH = ROOT / "deploy" / "upload-manifest.json"


@dataclass(frozen=True)
class LocalFile:
    rel: str
    path: Path
    size: int
    mtime: float


@dataclass(frozen=True)
class RemoteFile:
    size: int
    mtime: float | None = None


def collect_local_files(out_dir: Path = OUT_DIR) -> list[LocalFile]:
    files: list[LocalFile] = []
    for root, _, fnames in os.walk(out_dir):
        for fname in fnames:
            path = Path(root) / fname
            stat = path.stat()
            rel = path.relative_to(out_dir).as_posix()
            files.append(LocalFile(rel=rel, path=path, size=stat.st_size, mtime=stat.st_mtime))
    files.sort(key=lambda item: item.rel)
    return files


def parse_mlsd_mtime(modify: str | None) -> float | None:
    if not modify or len(modify) < 14:
        return None
    try:
        return time.mktime(time.strptime(modify[:14], "%Y%m%d%H%M%S"))
    except ValueError:
        return None


def parse_mdtm_response(line: str) -> float | None:
    parts = line.strip().split()
    if len(parts) < 2:
        return None
    token = parts[-1]
    if len(token) < 14 or not token[:14].isdigit():
        return None
    return parse_mlsd_mtime(token[:14])


def needs_upload(
    local: LocalFile,
    remote: RemoteFile | None,
    *,
    mtime_tolerance_sec: float = 2.0,
) -> tuple[bool, str]:
    if remote is None:
        return True, "missing-remote"
    if local.size != remote.size:
        return True, "size-changed"
    if remote.mtime is not None and local.mtime > remote.mtime + mtime_tolerance_sec:
        return True, "local-newer"
    return False, "unchanged"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest() -> dict[str, dict]:
    if not MANIFEST_PATH.exists():
        return {}
    try:
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        return data.get("files", {})
    except (json.JSONDecodeError, OSError):
        return {}


def save_manifest(local_files: list[LocalFile], *, use_sha: bool = False) -> None:
    files: dict[str, dict] = {}
    for item in local_files:
        entry: dict[str, int | str] = {"size": item.size}
        if use_sha:
            entry["sha256"] = file_sha256(item.path)
        files[item.rel] = entry
    payload = {
        "deployedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "fileCount": len(files),
        "files": files,
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"[manifest] saved {len(files)} entries -> {MANIFEST_PATH.name}")


def plan_manifest_uploads(
    local_files: list[LocalFile],
    manifest_files: dict[str, dict],
    *,
    full: bool = False,
    use_sha: bool = False,
) -> tuple[list[LocalFile], dict[str, int]]:
    stats = {"unchanged": 0, "new": 0, "changed": 0, "forced": 0}
    to_upload: list[LocalFile] = []
    for item in local_files:
        if full:
            to_upload.append(item)
            stats["forced"] += 1
            continue
        prev = manifest_files.get(item.rel)
        if prev is None:
            to_upload.append(item)
            stats["new"] += 1
            continue
        if prev.get("size") != item.size:
            to_upload.append(item)
            stats["changed"] += 1
            continue
        if use_sha and prev.get("sha256") != file_sha256(item.path):
            to_upload.append(item)
            stats["changed"] += 1
            continue
        stats["unchanged"] += 1
    return to_upload, stats


def extract_build_id(html_path: Path = OUT_DIR / "index.html") -> str | None:
    if not html_path.exists():
        return None
    head = html_path.read_text(encoding="utf-8", errors="ignore")[:300]
    if "<!--" not in head:
        return None
    start = head.index("<!--") + 4
    end = head.index("-->", start)
    token = head[start:end].strip()
    return token or None


def seed_manifest_from_out(out_dir: Path = OUT_DIR) -> None:
    save_manifest(collect_local_files(out_dir))


def merge_htaccess(stamp: str) -> Path:
    import re

    backup_ht = BACKUP_DIR / f"{stamp}-.htaccess"
    if not backup_ht.exists():
        candidates = sorted(BACKUP_DIR.glob("*-.htaccess"), reverse=True)
        if candidates:
            backup_ht = candidates[0]
            print(f"[merge] using prior backup {backup_ht.name}")
    merged = BACKUP_DIR / f"{stamp}-htaccess.merged"
    snippet = HTACCESS_SNIPPET.read_text(encoding="utf-8").strip()
    marker = "# --- Next.js static (ybb-site) ---"

    if backup_ht.exists():
        content = backup_ht.read_text(encoding="utf-8", errors="ignore")
    else:
        content = ""

    # Drop any prior ybb-site block so re-deploys stay idempotent.
    if marker in content:
        content = re.sub(
            rf"\n*{re.escape(marker)}[\s\S]*?(?=\n# BEGIN WordPress|\n# SGO|\Z)",
            "",
            content,
            count=1,
        ).rstrip()

    wp_begin = "# BEGIN WordPress"
    wp_end = "# END WordPress"
    preamble = content
    wp_block = ""
    postamble = ""

    if wp_begin in content and wp_end in content:
        pre, rest = content.split(wp_begin, 1)
        wp_inner, post = rest.split(wp_end, 1)
        preamble = pre.rstrip()
        wp_block = f"{wp_begin}{wp_inner}{wp_end}"
        postamble = post.strip()

    if "DirectoryIndex index.html" not in preamble:
        preamble = "DirectoryIndex index.html index.php\n\n" + preamble.lstrip()

    parts = [preamble.strip(), f"{marker}\n{snippet}"]
    if wp_block:
        parts.append(wp_block)
    if postamble:
        parts.append(postamble)

    merged.write_text("\n\n".join(parts).rstrip() + "\n", encoding="utf-8")
    return merged


def plan_uploads(
    local_files: list[LocalFile],
    remote_index: dict[str, RemoteFile],
    *,
    full: bool = False,
) -> tuple[list[LocalFile], dict[str, int]]:
    stats = {"unchanged": 0, "missing-remote": 0, "size-changed": 0, "local-newer": 0, "forced": 0}
    to_upload: list[LocalFile] = []
    for item in local_files:
        if full:
            to_upload.append(item)
            stats["forced"] += 1
            continue
        upload, reason = needs_upload(item, remote_index.get(item.rel))
        if upload:
            to_upload.append(item)
            stats[reason] += 1
        else:
            stats["unchanged"] += 1
    return to_upload, stats


def print_plan(
    total: int,
    to_upload: list[LocalFile],
    stats: dict[str, int],
    *,
    dry_run: bool,
    source: str,
) -> None:
    mode = "dry-run" if dry_run else "incremental"
    extra = " ".join(f"{k}={v}" for k, v in stats.items() if v)
    print(f"[deploy] mode={mode} source={source} total={total} upload={len(to_upload)} skip={stats.get('unchanged', 0)} ({extra})")
