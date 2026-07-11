#!/usr/bin/env python3
"""Restore glyphs corrupted by repair_all_json.py (JSON + TSX)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDTMP = ROOT.parent / "ybb-site-buildtmp"
BAD = "\ufffd?"


def fix_collections() -> None:
    src_path = BUILDTMP / "lib/data/collections.json"
    if not src_path.is_file():
        print("skip collections (no buildtmp)")
        return
    src_map = {
        c["handle"]: c for c in json.loads(src_path.read_text(encoding="utf-8"))
    }
    dst = ROOT / "lib/data/collections.json"
    cur = json.loads(dst.read_text(encoding="utf-8"))
    for item in cur:
        ref = src_map.get(item["handle"])
        if not ref:
            continue
        for key in ("description", "titleCn"):
            val = item.get(key, "")
            if "?" in val or "\ufffd" in val:
                item[key] = ref[key]
    dst.write_text(
        json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("fixed lib/data/collections.json")


def fix_megamenu() -> None:
    path = ROOT / "components/layout/MegaMenu.tsx"
    text = path.read_text(encoding="utf-8")
    if "overview" in text and "no collection" in text:
        text = re.sub(
            r"overview[^\n]*no collection",
            "overview — no collection",
            text,
            count=1,
        )
    text = re.sub(
        r"\{labelFor\(megaMenu\.shopAll\)\}[^\n<]+",
        "{labelFor(megaMenu.shopAll)} {MENU_ARROW}",
        text,
    )
    text = re.sub(
        r"\{labelFor\(child\)\}[^\n<]+",
        "{labelFor(child)} {MENU_ARROW}",
        text,
    )
    text = re.sub(
        r'(\{productCount > 0 \? ` \(\{productCount\}\)` : ""\})[^\n<]+',
        r"\1 {MENU_ARROW}",
        text,
    )
    text = re.sub(
        r'(<span className="text-\[10px\] opacity-50" aria-hidden>)[^<]+(</span>)',
        r"\1{MENU_CHEVRON}\2",
        text,
        count=1,
    )
    path.write_text(text, encoding="utf-8")
    print("fixed components/layout/MegaMenu.tsx")


def fix_tsx_glyphs() -> None:
    """Replace U+FFFD? corruption in PDP / drawer close buttons."""
    close_btn = '            {"\\u00D7"}\n          </button>'
    targets: list[tuple[str, list[tuple[str, str]]]] = [
        (
            "components/product/ProductPurchasePanel.tsx",
            [(f"              {BAD}            </button>", '              {"\\u2212"}\n            </button>')],
        ),
        (
            "components/layout/MobileNavDrawer.tsx",
            [(f"            {BAD}          </button>", close_btn)],
        ),
        (
            "components/layout/SearchDrawer.tsx",
            [(f"              {BAD}            </button>", close_btn)],
        ),
        (
            "components/product/FilterDrawer.tsx",
            [
                (f"          {BAD}        </span>", '          {"\\u25BE"}\n        </span>'),
                (f"            {BAD}          </button>", close_btn),
            ],
        ),
        (
            "components/cart/CartDrawer.tsx",
            [
                (f"            {BAD}\n          </button>", close_btn),
                (
                    f"                          {BAD}\n                        </button>",
                    '                          {"\\u2212"}\n                        </button>',
                ),
            ],
        ),
    ]
    for rel, reps in targets:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in reps:
            text = text.replace(old, new, 1)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print(f"fixed {rel}")

    add_path = ROOT / "components/cart/AddToCartButton.tsx"
    add_text = add_path.read_text(encoding="utf-8")
    add_new = re.sub(
        r"\$\{label\}[^\$]*\$\{formatPrice\(product\.price\)\}",
        r'${label}${" \\u2014 "}${formatPrice(product.price)}',
        add_text,
        count=1,
    )
    if add_new != add_text:
        add_path.write_text(add_new, encoding="utf-8")
        print("fixed components/cart/AddToCartButton.tsx")

    hero_path = ROOT / "components/home/HeroCarousel.tsx"
    hero_text = hero_path.read_text(encoding="utf-8")
    hero_new = re.sub(
        r'<h1 className="sr-only">YBB Tackle[^<]+Wholesale Terminal Tackle Factory</h1>',
        lambda _m: '<h1 className="sr-only">YBB Tackle{"\\u2014"}Wholesale Terminal Tackle Factory</h1>',
        hero_text,
        count=1,
    )
    if hero_new != hero_text:
        hero_path.write_text(hero_new, encoding="utf-8")
        print("fixed components/home/HeroCarousel.tsx")


def main() -> None:
    fix_collections()
    fix_megamenu()
    fix_tsx_glyphs()


if __name__ == "__main__":
    main()
