"""Canonical variant SKU rules shared by patch builder, form import, and sync."""

from __future__ import annotations

import html
import re
import unicodedata
from typing import Any

SKU_SAFE_RE = re.compile(r"[^\w\-+#./]+", re.UNICODE)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip()
    return re.sub(r"\s+", " ", text)


def sanitize_spec_for_sku(spec: str) -> str:
    spec = clean_text(spec)
    if not spec:
        return "default"
    spec = html.unescape(spec)
    spec = spec.replace("&#10;", "").replace("\n", "").replace("\r", "")
    spec = spec.replace("/", "-").replace("\\", "-")
    spec = spec.replace("*", "")
    spec = re.sub(r"\s+", " ", spec).strip()
    return SKU_SAFE_RE.sub("-", spec).strip("-") or "default"


def canonical_variant_sku(parent_sku: str, spec: str) -> str:
    parent = clean_text(parent_sku)
    return f"{parent}-{sanitize_spec_for_sku(spec)}"
