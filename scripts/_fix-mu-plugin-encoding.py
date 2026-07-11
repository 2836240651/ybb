#!/usr/bin/env python3
"""Fix corrupted string literals in mu-plugins (encoding damage -> PHP parse fatal)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "deploy/wp-content/mu-plugins"

FIXES: dict[str, dict[int, str]] = {
    "ybb-locale.php": {
        31: "        'ja' => '\u65e5\u672c\u8a9e',",
        224: " * Render EN / \u4e2d\u6587 / \u65e5\u672c\u8a9e switcher links.",
    },
    "ybb-site-brand.php": {
        20: "            'zh' => '\u503c\u5f97\u4fe1\u8d56\u7684\u6e14\u5177\u5408\u4f5c\u4f19\u4f34',",
    },
    "ybb-my-account/ybb-my-account.php": {
        123: "            'cart' => '\u8d2d\u7269\u8f66',",
        126: "            'home' => '\u30db\u30fc\u30e0',",
        127: "            'account' => '\u30de\u30a4\u30a2\u30ab\u30a6\u30f3\u30c8',",
        128: "            'crumb' => '\u30db\u30fc\u30e0 / \u30de\u30a4\u30a2\u30ab\u30a6\u30f3\u30c8',",
        135: "            'cart' => '\u30ab\u30fc\u30c8',",
    },
    "ybb-flat-checkout/ybb-flat-checkout.php": {
        196: "            'step' => '\u7b2c 2 / 3 \u6b65',",
        197: "            'crumb' => '\u9996\u9875 / \u8d2d\u7269\u8f66 / \u7ed3\u8d26',",
        198: "            'back_to_cart' => '\u2190 \u8fd4\u56de\u8d2d\u7269\u8f66',",
        199: "            'safe' => '\u5b89\u5168\u7ed3\u8d26 | SSL \u52a0\u5bc6 | \u7a7a\u4e2d\u4e91\u6c47\u6258\u7ba1\u652f\u4ed8\u3002',",
        202: "            'home' => '\u30db\u30fc\u30e0',",
        206: "            'checkout' => '\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8',",
        208: "            'crumb' => '\u30db\u30fc\u30e0 / \u30ab\u30fc\u30c8 / \u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8',",
        210: "            'safe' => '\u5b89\u5168\u306a\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8 | SSL \u6697\u53f7\u5316 | Airwallex \u30db\u30b9\u30c8\u6c7a\u6e08\u3002',",
    },
    "ybb-product-reviews/includes/review-import-engine.php": {
        66: "                ? '\u7ad9\u5185\u5a92\u4f53\u5e93 URL\uff08\u5df2\u5339\u914d\u9644\u4ef6 #' . $attachment_id . '\uff09'",
        67: "                : '\u7ad9\u5185 URL\uff0c\u5bfc\u5165\u65f6\u5c06 sideload',",
        87: "                ? 'Amazon \u5916\u94fe\u53ef\u80fd\u88ab\u670d\u52a1\u5668 IP \u62d2\u7edd\uff08' . $err . '\uff09\uff1b\u8bf7\u4e0a\u4f20\u5230\u5a92\u4f53\u5e93\u540e\u6539\u7528\u7ad9\u5185 URL \u91cd\u5bfc'",
        88: "                : '\u56fe\u7247 URL \u65e0\u6cd5\u8bbf\u95ee\uff08' . $err . '\uff09',",
        96: "            'message' => 'Amazon \u5916\u94fe\uff1aHEAD \u53ef\u8fbe\uff0csideload \u4ecd\u53ef\u80fd\u5931\u8d25\uff1b\u5efa\u8bae\u6539\u4e3a\u7ad9\u5185\u5a92\u4f53\u5e93 URL',",
        103: "        'message' => '\u8fdc\u7a0b URL \u53ef\u8bbf\u95ee',",
        147: "        return ['rows' => [], 'errors' => ['CSV \u7f3a\u5c11\u8868\u5934']];",
        165: "        $errors[] = '\u8d85\u8fc7\u5355\u6b21\u4e0a\u9650 ' . YBB_PR_IMPORT_MAX_ROWS . ' \u884c';",
        180: "        return ['rows' => [], 'errors' => ['\u7f3a\u5c11 SimpleXLSX \u5e93\uff0c\u8bf7\u6539\u7528 CSV \u6216\u91cd\u65b0\u4e0a\u4f20\u63d2\u4ef6\u76ee\u5f55']];",
        218: "        return ['rows' => [], 'errors' => ['\u8d85\u8fc7\u5355\u6b21\u4e0a\u9650 ' . YBB_PR_IMPORT_MAX_ROWS . ' \u884c']];",
        259: "                    'note' => '\u53d8\u4f53 ID \u5df2\u6620\u5c04\u5230\u7236\u5546\u54c1 #' . $parent_id,",
        279: "                        'note' => '\u53d8\u4f53 SKU \u5df2\u6620\u5c04\u5230\u7236\u5546\u54c1',",
        287: "        return new WP_Error('sku_not_found', '\u672a\u627e\u5230 SKU\uff1a' . $sku);",
        309: "        return new WP_Error('handle_not_found', '\u672a\u627e\u5230 handle\uff1a' . $handle);",
        312: "    return new WP_Error('missing_product', '\u8bf7\u586b\u5199 wc_product_id\u3001product_sku \u6216 product_handle \u4e4b\u4e00');",
        383: "        $errors[] = 'rating \u987b\u4e3a 1\u20135';",
        405: "            $warnings[] = '\u56fe ' . $n . '\uff1a' . $probe['message'];",
        454: "            '\u4e0b\u8f7d\u56fe\u7247\u5931\u8d25\uff1a' . $tmp->get_error_message()",
        558: "            $images_failed[] = '\u56fe ' . $n . '\uff1a' . $uploaded->get_error_message();",
        667: "        return ['rows' => [], 'errors' => ['\u4ec5\u652f\u6301 .csv \u6216 .xlsx'], 'file_hash' => ''];",
    },
    "ybb-product-reviews/includes/review-import-admin.php": {
        40: "                $message = implode('\uff1b ', $parsed['errors']);",
        59: "                $message = '\u9884\u89c8\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u4e0a\u4f20\u6587\u4ef6';",
        72: "                            '\u8bc4\u4ef7\u5bfc\u5165\uff1a\u6210\u529f %d\uff0c\u8b66\u544a %d\uff0c\u8df3\u8fc7 %d\uff0c\u5931\u8d25 %d',",
        89: "                    '\u5bfc\u5165\u5b8c\u6210\uff1a\u6210\u529f %d\uff0c\u5e26\u8b66\u544a %d\uff0c\u8df3\u8fc7 %d\uff0c\u5931\u8d25 %d',",
        102: "        $message = '\u5df2\u53d6\u6d88\u9884\u89c8';",
        158: "                    <?php submit_button('\u786e\u8ba4\u5bfc\u5165 ' . $importable . ' \u6761', 'primary', 'submit', false); ?>",
        221: "                $img_lines[] = '\u56fe ' . $n . ': ' . ($probe['message'] ?? '');",
        244: "                <td><small><?php echo esc_html(implode('\uff1b ', $notes)); ?></small></td>",
    },
    "ybb-home-settings.php": {
        470: "        button: { text: '\u4f7f\u7528\u6b64\u56fe\u7247' },",
    },
}


def main() -> int:
    for rel, line_map in FIXES.items():
        path = ROOT / rel
        lines = path.read_text(encoding="utf-8").splitlines()
        for ln, content in line_map.items():
            lines[ln - 1] = content
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"fixed {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
