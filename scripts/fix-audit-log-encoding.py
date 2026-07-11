#!/usr/bin/env python3
"""Repair encoding-corrupted PHP string literals in audit-log.php."""
from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php"
)

# Exact line replacements (full line match after strip not required — unique substrings)
EXACT: list[tuple[str, str]] = [
    ("'contact' => '联系\ufffd?,", "'contact' => '联系',"),
    ("'deploy_start' => '开始部\ufffd?,", "'deploy_start' => '开始部署',"),
    ("return '（空\ufffd?;", "return '（空）';"),
    ("return mb_substr($text, 0, $max) . '\ufffd?;", "return mb_substr($text, 0, $max) . '…';"),
    (
        "$headline = $headlines[0] ?? '配置已保\ufffd?;",
        "$headline = $headlines[0] ?? '配置已保存';",
    ),
    (
        "$headline .= '\ufffd? . implode('\ufffd?, array_slice($headlines, 1));",
        "$headline .= '；' . implode('；', array_slice($headlines, 1));",
    ),
    (
        "strpos($headline, '无字段改\ufffd?) !== false",
        "strpos($headline, '无字段改动') !== false",
    ),
    (
        "return implode('\ufffd?, array_filter([$headline, $verifyMessage]));",
        "return implode('；', array_filter([$headline, $verifyMessage]));",
    ),
    (
        "$row['summary'] = $row['actionLabel'] . ' \ufffd?' . $row['moduleLabel'];",
        "$row['summary'] = $row['actionLabel'] . ' · ' . $row['moduleLabel'];",
    ),
    (
        "'summary' => $lines[0] ?? '配置已保\ufffd?,",
        "'summary' => $lines[0] ?? '配置已保存',",
    ),
    (
        "strpos($lines[0], '已保\ufffd?) === false",
        "strpos($lines[0], '已保存') === false",
    ),
    (
        "'summary' => '已将\ufffd? . ($labels[$module] ?? $module) . '】恢复为默认',",
        "'summary' => '已将【' . ($labels[$module] ?? $module) . '】恢复为默认',",
    ),
    (
        "'detail' => '仅该模块恢复默认，其他模块未改动\ufffd?,",
        "'detail' => '仅该模块恢复默认，其他模块未改动。',",
    ),
    (
        "ybb_sm_audit_log_deploy_event('save', 'info', 'Deploy Secret 已更\ufffd?, [], '密钥不明文记录\ufffd?);",
        "ybb_sm_audit_log_deploy_event('save', 'info', 'Deploy Secret 已更新', [], '密钥不明文记录。');",
    ),
    (
        "? '浏览器打开首页\ufffd?Ctrl+Shift+R 硬刷\ufffd?",
        "? '浏览器打开首页，Ctrl+Shift+R 硬刷新'",
    ),
    (
        ": '若未生效：SiteGround \ufffd?Purge Cache 后硬刷新',",
        ": '若未生效：SiteGround → Purge Cache 后硬刷新',",
    ),
    (
        "fputcsv($out, ['时间', '操作\ufffd?, '类别', '模块', '动作', '状\ufffd?, '摘要', '详情', '下一\ufffd?]);",
        "fputcsv($out, ['时间', '操作人', '类别', '模块', '动作', '状态', '摘要', '详情', '下一步']);",
    ),
]

# Regex replacements (order matters)
REGEX: list[tuple[re.Pattern[str], str]] = [
    # arrow between values
    (re.compile(r" \ufffd\?'"), " → '"),
    (re.compile(r"'\ufffd\? \."), "'】' ."),
    (re.compile(r" · \ufffd\? \."), " · 【' ."),
    # ternary broken endings
    (re.compile(r"\? '已显\ufffd\? : '已隐\ufffd\?\)"), "? '已显示' : '已隐藏')"),
    (re.compile(r"\? '已开\ufffd\? : '已关\ufffd\?\)"), "? '已开启' : '已关闭')"),
    (re.compile(r"\? '\ufffd\? : '\ufffd\?\)"), "? '是' : '否')"),
    # label colon patterns
    (re.compile(r"'Hero\ufffd\? \."), "'Hero：' ."),
    (re.compile(r"'博客\ufffd\? \."), "'博客：' ."),
    (re.compile(r"'视频模块\ufffd\? \."), "'视频模块：' ."),
    (re.compile(r"'Featured\ufffd\? \."), "'Featured：' ."),
    (re.compile(r"'产品覆盖\ufffd\? \."), "'产品覆盖：' ."),
    (re.compile(r"'Hot Products 间隔\ufffd\? \."), "'Hot Products 间隔：' ."),
    (re.compile(r"'Latest Stories 轮播\ufffd\? \."), "'Latest Stories 轮播：' ."),
    (re.compile(r"'自动播放间隔\ufffd\? \."), "'自动播放间隔：' ."),
    (re.compile(r"\$label \. '\ufffd\? \."), "$label . '：' ."),
    (re.compile(r" · Hot\ufffd\? \."), " · Hot【' ."),
    (re.compile(r" · Story\ufffd\? \."), " · Story【' ."),
    # suffix fragments
    (re.compile(r"已修\ufffd\?;"), "已修改';"),
    (re.compile(r"已更\ufffd\?;"), "已更新';"),
    (re.compile(r"无字段改动\ufffd\?;"), "无字段改动';"),
    (re.compile(r"slug\ufffd\? \."), "slug：' ."),
    (re.compile(r"handle\ufffd\? \."), "handle：' ."),
    (re.compile(r"新增\ufffd\? \."), "新增：' ."),
    (re.compile(r"新增导航\ufffd\? \."), "新增导航项【' ."),
    (re.compile(r"已移除导航\ufffd\? \."), "已移除导航项【' ."),
    (re.compile(r"已移除轮播\ufffd\? \."), "已移除轮播项【' ."),
    (re.compile(r"已移除文章\ufffd\? \."), "已移除文章【' ."),
    (re.compile(r" Hot 已移除\ufffd\? \."), " Hot 已移除【' ."),
    (re.compile(r" Story 已移除\ufffd\? \."), " Story 已移除【' ."),
    (re.compile(r"Products 新增\ufffd\? \."), "Products 新增【' ."),
    (re.compile(r"Stories 新增\ufffd\? \."), "Stories 新增【' ."),
    (re.compile(r" · \ufffd\? \. \$name \. '\ufffd\? \."), " · 【' . $name . '】' ."),
    (re.compile(r" · \ufffd\? \. \$name \. '\]"), " · 【' . $name . '】"),  # noop safety
    (re.compile(r" · \ufffd\? \. \$id \. '\ufffd\? \."), " · 【' . $id . '】' ."),
    (re.compile(r" · \ufffd\? \. \$name \. '\ufffd\? \. \$locLabel \. '\ufffd\? \."), " · 【' . $name . '】' . $locLabel . '：' ."),
    (re.compile(r" · \ufffd\? \. \$id \. '\ufffd\? \. \$locLabel \. '\ufffd\? \."), " · 【' . $id . '】' . $locLabel . '：' ."),
    (re.compile(r" · \ufffd\? \. \$name \. '\ufffd\? \. \$locLabel \. '标题\ufffd\? \."), " · 【' . $name . '】' . $locLabel . '标题：' ."),
    (re.compile(r" · \ufffd\? \. \$name \. '\]"), " · 【' . $name . '】"),  # partial
    (re.compile(r"ybb_sm_audit_item_display_name\(\$slide, '\ufffd\?' \. \(\$i \+ 1\) \. ' \ufffd\?\)"), "ybb_sm_audit_item_display_name($slide, '第' . ($i + 1) . '张')"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]链接"), " · 【' . $name . '】链接"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]英文"), " · 【' . $name . '】英文"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]首页"), " · 【' . $name . '】首页"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]标题"), " · 【' . $name . '】标题"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]头图"), " · 【' . $name . '】头图"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]摘要"), " · 【' . $name . '】摘要"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]正文"), " · 【' . $name . '】正文"),
    (re.compile(r" · \ufffd\? \. \$name \. '\]图片"), " · 【' . $name . '】图片"),
    (re.compile(r" · 主推产品\ufffd\? \."), " · 主推产品：' ."),
    (re.compile(r" · 全站购买\ufffd\?slogan"), " · 全站购买区 slogan"),
    (re.compile(r"默认已更\ufffd\?;"), "默认已更新';"),
    (re.compile(r"图库启用\ufffd\? \."), "图库启用：' ."),
    (re.compile(r"URL 已修\ufffd\?;"), "URL 已修改';"),
    (re.compile(r"ybb_sm_audit_diff_label_locales\(\$b\['tagline'\].*'副标\ufffd\?\)"), "ybb_sm_audit_diff_label_locales($b['tagline'] ?? [], $a['tagline'] ?? [], '副标题')"),
]


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
    text = TARGET.read_text(encoding="utf-8")
    for old, new in EXACT:
        if old not in text:
            # try without replacement char
            alt = old.replace("\ufffd", "")
            if alt in text:
                text = text.replace(alt, new)
        else:
            text = text.replace(old, new)

    for pattern, repl in REGEX:
        text = pattern.sub(repl, text)

    # Generic fixes for remaining broken lines
    lines_out: list[str] = []
    for line in text.splitlines():
        fixed = line
        if odd_single_quotes(fixed):
            # close dangling string before ); or ,
            fixed = re.sub(
                r"'\ufffd\?(\s*[\),;])",
                lambda m: "'" + ("，" if m.group(1).strip() in {",", ";"} else "") + "'" + m.group(1),
                fixed,
            )
            fixed = re.sub(r"'\ufffd\?;", "'。';", fixed)
            fixed = re.sub(r"'\ufffd\?,", "'，',", fixed)
            fixed = re.sub(r" · \ufffd\? \.", " · 【' .", fixed)
            fixed = re.sub(r"'\ufffd\? \.", "'：' .", fixed)
            fixed = re.sub(r" \ufffd\?'", " → '", fixed)
            fixed = re.sub(r"\? '已显[^']*$", "? '已显示' : '已隐藏');", fixed)
            fixed = re.sub(r"\? '已开[^']*$", "? '已开启' : '已关闭');", fixed)
        lines_out.append(fixed)

    text = "\n".join(lines_out) + "\n"
    TARGET.write_text(text, encoding="utf-8")

    remaining = sum(1 for ln in text.splitlines() if odd_single_quotes(ln) and ln.strip())
    print(f"remaining_odd_quote_lines={remaining}")
    if remaining:
        for no, line in enumerate(text.splitlines(), 1):
            if odd_single_quotes(line) and line.strip():
                print(f"  {no}: {line[:120]}")
        return 1
    print(f"fixed {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
