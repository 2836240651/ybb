#!/usr/bin/env bash
# Linux deploy runner — polls WP deploy queue and runs sync → build → FTPS upload.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${ROOT}/.venv/bin/python3"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="python3"
fi

SITE="${SITE:-https://carp-ybb.com}"
POLL=0
FORCE=0
INTERVAL_SEC=300

while [[ $# -gt 0 ]]; do
  case "$1" in
    --poll) POLL=1; shift ;;
    --force) FORCE=1; shift ;;
    --interval) INTERVAL_SEC="$2"; shift 2 ;;
    --site) SITE="$2"; shift 2 ;;
    *) echo "Usage: $0 [--poll] [--force] [--interval 300] [--site URL]" >&2; exit 1 ;;
  esac
done

load_key() {
  $PYTHON - <<'PY'
import json, sys
from pathlib import Path
p = Path("secrets.local.json")
if not p.is_file():
    sys.exit("missing secrets.local.json (deploy.runnerKey)")
d = json.loads(p.read_text(encoding="utf-8"))
k = (d.get("deploy") or {}).get("runnerKey") or ""
if not k:
    sys.exit("secrets.local.json missing deploy.runnerKey")
print(k)
PY
}

rest_get() {
  local route="$1"
  local key="$2"
  curl -fsS -H "X-YBB-Deploy-Key: $key" \
    "${SITE}/index.php?rest_route=${route}&pending=1&_=$(date +%s)"
}

rest_post() {
  local route="$1"
  local key="$2"
  local body="${3:-{}}"
  curl -fsS -X POST -H "X-YBB-Deploy-Key: $key" -H "Content-Type: application/json" \
    -d "$body" "${SITE}/index.php?rest_route=${route}"
}

deploy_step() {
  local step="$1"
  local label="$2"
  local key="$3"
  rest_post "/ybb/v1/deploy/step" "$key" "$($PYTHON -c "import json; print(json.dumps({'step':'$step','label':'''$label'''}))")" \
    >/dev/null 2>&1 || true
}

complete_deploy() {
  local key="$1"
  local state="$2"
  local build_id="${3:-}"
  local err="${4:-}"
  local payload
  payload="$(STATE="$state" BUILD_ID="$build_id" ERR="$err" $PYTHON - <<'PY'
import json, os
from pathlib import Path
body = {
    "state": os.environ.get("STATE", "failed"),
    "buildId": os.environ.get("BUILD_ID", ""),
    "error": os.environ.get("ERR", ""),
}
p = Path("lib/data/products.json")
if body["state"] == "success" and p.is_file():
    data = json.loads(p.read_text(encoding="utf-8"))
    handles = [str(x.get("handle", "")) for x in data if isinstance(data, list) and x.get("handle")]
    body["productCount"] = len(handles)
    body["productHandles"] = handles
print(json.dumps(body))
PY
)"
  curl -fsS -X POST -H "X-YBB-Deploy-Key: $key" -H "Content-Type: application/json" \
    -d "$payload" "${SITE}/index.php?rest_route=/ybb/v1/deploy/complete" >/dev/null
}

local_build_id() {
  $PYTHON - <<'PY'
import re
from pathlib import Path
p = Path("out/index.html")
if not p.is_file():
    raise SystemExit(0)
m = re.search(r"<!--([^>]+)-->", p.read_text(encoding="utf-8", errors="ignore"))
if m:
    print(m.group(1).strip())
PY
}

run_pipeline() {
  local key="${1:-}"
  deploy_step sync "正在从 WooCommerce 同步产品数据..." "$key"
  echo "[runner] sync-from-wp-playwright"
  $PYTHON -u scripts/sync-from-wp-playwright.py --site "$SITE" --fetch-variations

  deploy_step variations "正在对齐变体 wcId..." "$key"
  echo "[runner] fix-variation-ids-playwright"
  $PYTHON -u scripts/fix-variation-ids-playwright.py

  deploy_step accept "正在验收 wcId / add-item 漂移..." "$key"
  echo "[runner] product-sync-acceptance (pre-deploy)"
  $PYTHON -u scripts/product-sync-acceptance.py --site "$SITE" --cache-only

  deploy_step build "正在构建静态站..." "$key"
  echo "[runner] build-static"
  bash scripts/build-static.sh --site "$SITE" --skip-sync

  deploy_step audit "正在审计部署包..." "$key"
  echo "[runner] audit"
  $PYTHON -u scripts/audit-deploy-package.py

  deploy_step upload "正在上传静态文件 (FTPS zip)..." "$key"
  echo "[runner] siteground_deploy_cli deploy-static"
  $PYTHON -u scripts/siteground_deploy_cli.py deploy-static

  deploy_step verify "正在验证远程 buildId..." "$key"
  echo "[runner] verify-remote-deploy"
  $PYTHON -u scripts/verify-remote-deploy.py

  $PYTHON -u scripts/product-sync-acceptance.py --site "$SITE" --post-deploy
}

run_claim_pipeline() {
  local key="$1"
  echo "[runner] claim job"
  claimed="$(rest_post "/ybb/v1/deploy/claim" "$key" '{}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('claimed', False))")"
  if [[ "$claimed" != "True" && "$claimed" != "true" ]]; then
    echo "[runner] nothing to claim"
    return 0
  fi
  set +e
  run_pipeline "$key"
  pipeline_rc=$?
  set -e
  if [[ "$pipeline_rc" -eq 0 ]]; then
    bid="$(local_build_id)"
    complete_deploy "$key" success "$bid"
    echo "[runner] success buildId=$bid"
  else
    complete_deploy "$key" failed "" "pipeline failed"
    return 1
  fi
}

check_and_run() {
  local key
  key="$(load_key)"
  status="$(rest_get "/ybb/v1/deploy/status" "$key")"
  ready="$(echo "$status" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('readyToRun') or d.get('pending') else 'no')")"
  if [[ "$ready" == "yes" ]]; then
    run_claim_pipeline "$key"
  else
    state="$(echo "$status" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','idle'))")"
    pending="$(echo "$status" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pending', False))")"
    echo "[runner] idle state=$state pending=$pending"
  fi
}

KEY="$(load_key)"

if [[ "$FORCE" -eq 1 ]]; then
  echo "[runner] force pipeline"
  set +e
  run_pipeline "$KEY"
  pipeline_rc=$?
  set -e
  if [[ "$pipeline_rc" -eq 0 ]]; then
    bid="$(local_build_id)"
    complete_deploy "$KEY" success "$bid"
    echo "[runner] force success buildId=$bid"
  else
    complete_deploy "$KEY" failed "" "force pipeline failed"
    exit 1
  fi
elif [[ "$POLL" -eq 1 ]]; then
  while true; do
    check_and_run || true
    sleep "$INTERVAL_SEC"
  done
else
  check_and_run
fi
