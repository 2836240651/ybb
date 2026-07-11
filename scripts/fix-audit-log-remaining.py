#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php"
)

FIXES: dict[int, str] = {
    359: "                    $lines[] = '  ⚠ 空类目：' . ($warning['label'] ?? $warning['handle']) . '【'",
    360: "                        . '】' . ($warning['handle'] ?? '') . '，Woo publish 0';",
    450: "                        $lines[] = '  · 【' . $name . '】' . $locLabel . '标题：' . ybb_sm_audit_truncate($oz) . ' → ' . ybb_sm_audit_truncate($nz);",
    745: "            'message' => '接口检测失败，配置已保存；请刷新前台验证',",
    751: "        return ['http' => $code, 'status' => 'ok', 'message' => '接口正常，刷新前台即可（无需部署）'];",
    835: "        'manual' => '管理员手动',",
    847: "        return '部署包审计未通过，线上未被覆盖';",
    856: "        return '上传静态文件失败';",
}


def odd_single_quotes(line: str) -> bool:
    count = 0
    i = 0
    while i < len(line):
        if line[i] == "\\":
            i += 2
            continue
        if line[i] == "'":
            count += 1
        i += 1
    return count % 2 == 1


def main() -> int:
    lines = TARGET.read_text(encoding="utf-8").splitlines()
    for ln, content in FIXES.items():
        lines[ln - 1] = content
    TARGET.write_text("\n".join(lines) + "\n", encoding="utf-8")
    remaining = [
        (i + 1, ln)
        for i, ln in enumerate(lines)
        if odd_single_quotes(ln) and ln.strip()
    ]
    print(f"remaining={len(remaining)}")
    for no, ln in remaining:
        print(no, ln[:120])
    return 0 if not remaining else 1


if __name__ == "__main__":
    raise SystemExit(main())
