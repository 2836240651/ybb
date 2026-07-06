#!/usr/bin/env bash
# Linux/macOS static build (mirror of build-static.ps1, no deploy step).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PYTHON="${ROOT}/.venv/bin/python3"
[[ -x "$PYTHON" ]] || PYTHON="python3"

SITE_URL="${SITE_URL:-https://carp-ybb.com}"
export NEXT_PUBLIC_SITE_URL="$SITE_URL"
SKIP_SYNC=0
SKIP_DEPLOY=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site) SITE_URL="$2"; export NEXT_PUBLIC_SITE_URL="$SITE_URL"; shift 2 ;;
    --skip-sync) SKIP_SYNC=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

echo "[build-static] NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL"

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  echo "[build-static] sync-from-wp-playwright..."
  $PYTHON -u scripts/sync-from-wp-playwright.py --site "$SITE_URL" --fetch-variations
  echo "[build-static] sync-from-wp.mjs..."
  node scripts/sync-from-wp.mjs --site "$SITE_URL" --woo-cache reports/woo-store-products-cache.json --fetch-variations
fi

echo "[build-static] generate-variant-redirects..."
node scripts/generate-variant-redirects.mjs

echo "[build-static] npm run build..."
npm run build

echo "[build-static] prune stale PDP html..."
node scripts/prune-stale-product-html.mjs

[[ -f out/index.html ]] || { echo "missing out/index.html" >&2; exit 1; }

ZIP="deploy/ybb-static-export.zip"
rm -f "$ZIP"
(
  cd out
  zip -r -q "../$ZIP" .
)

echo "[build-static] OK: out/ and $ZIP"
