#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager"

FIXES: dict[str, dict[int, str]] = {
    "includes/modules/deploy-queue.php": {
        39: "                '已合并到进行中的部署任务：' . ybb_sm_audit_trigger_label($trigger) . '】',",
        41: "                '防抖窗口内多次触发仅执行一次部署。',",
        42: "                '约 ' . max(1, (int) ceil(($pendingUntil - $now) / 60)) . ' 分钟后 Runner 开始'",
        61: "            '已加入部署队列（' . ybb_sm_audit_trigger_label($trigger) . '），约 ' . $mins . ' 分钟后执行',",
        112: "            '正在同步产品并重建静态站…',",
    },
    "includes/modules/navigation.php": {
        149: "                'label' => trim((string) ($item['labels']['zh'] ?? $item['label'] ?? $item['id'] ?? '导航项')),",
        159: "                'label' => trim((string) ($child['labels']['zh'] ?? $child['label'] ?? '子类目')),",
    },
}


def main() -> int:
    for rel, line_fixes in FIXES.items():
        path = MU / rel
        lines = path.read_text(encoding="utf-8").splitlines()
        for ln, content in line_fixes.items():
            lines[ln - 1] = content
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"fixed {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
