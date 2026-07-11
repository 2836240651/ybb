#!/usr/bin/env python3
"""Re-enable mu-plugins disabled as *.php.off during isolation testing."""
from __future__ import annotations

import os
import sys
from ftplib import error_perm
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, cwd_to, load_secrets


def walk_dir(client, rel_dir: str, hits: list[tuple[str, str]]) -> None:
    try:
        entries = list(client.mlsd())
    except Exception:
        return
    for name, facts in entries:
        if name in (".", ".."):
            continue
        child = f"{rel_dir}/{name}" if rel_dir else name
        if facts.get("type") == "dir":
            client.cwd(name)
            walk_dir(client, child, hits)
            client.cwd("..")
        elif name.endswith(".php.off"):
            hits.append((rel_dir, name))


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/")
    mu = f"{remote_root}/wp-content/mu-plugins"
    client = connect_ftps(ftp)
    cwd_to(client, mu)

    hits: list[tuple[str, str]] = []
    walk_dir(client, "", hits)

    renamed = 0
    for rel_dir, name in hits:
        target_dir = f"{mu}/{rel_dir}" if rel_dir else mu
        cwd_to(client, target_dir)
        new_name = name[:-4]
        try:
            client.rename(name, new_name)
            path = f"{rel_dir}/{name}" if rel_dir else name
            print(f"[rename] {path} -> {new_name}")
            renamed += 1
        except error_perm as exc:
            print(f"[fail] {rel_dir}/{name}: {exc}")

    client.quit()
    print(f"[done] renamed {renamed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
