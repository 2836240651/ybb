<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_pr_import_admin_page_slug(): string
{
    return 'ybb-site-manager';
}

function ybb_pr_import_transient_key(int $user_id): string
{
    return 'ybb_pr_import_preview_' . $user_id;
}

function ybb_pr_render_import_admin_page(): void
{
    if (!current_user_can('manage_options')) {
        wp_die('Forbidden');
    }

    if (!empty($_GET['download']) && $_GET['download'] === 'template') {
        ybb_pr_import_send_template();
        return;
    }

    $message = '';
    $message_type = 'info';
    $preview = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('ybb_pr_import');

        $step = sanitize_key($_POST['ybb_pr_step'] ?? 'preview');

        if ($step === 'preview' && !empty($_FILES['import_file']['name'])) {
            $parsed = ybb_pr_import_parse_uploaded_file($_FILES['import_file']);
            if ($parsed['errors'] !== []) {
                $message = implode('； ', $parsed['errors']);
                $message_type = 'error';
            } elseif ($parsed['rows'] === []) {
                $message = '文件中没有可导入的数据行';
                $message_type = 'error';
            } else {
                $batch = ybb_pr_import_batch($parsed['rows'], true);
                $preview = $batch;
                set_transient(ybb_pr_import_transient_key(get_current_user_id()), [
                    'file_hash' => $parsed['file_hash'],
                    'filename' => sanitize_file_name((string) $_FILES['import_file']['name']),
                    'rows' => $parsed['rows'],
                    'preview' => $batch,
                    'saved_at' => time(),
                ], HOUR_IN_SECONDS);
            }
        } elseif ($step === 'import') {
            $stored = get_transient(ybb_pr_import_transient_key(get_current_user_id()));
            if (!is_array($stored) || empty($stored['rows'])) {
                $message = '预览已过期，请重新上传文件';
                $message_type = 'error';
            } else {
                @set_time_limit(120);
                $batch = ybb_pr_import_batch($stored['rows'], false);
                delete_transient(ybb_pr_import_transient_key(get_current_user_id()));

                if (function_exists('ybb_sm_audit_append')) {
                    ybb_sm_audit_append([
                        'module' => 'reviews_import',
                        'action' => 'import',
                        'status' => $batch['fail'] > 0 ? 'warning' : 'success',
                        'summary' => sprintf(
                            '评价导入：成功 %d，警告 %d，跳过 %d，失败 %d',
                            $batch['ok'],
                            $batch['warn'],
                            $batch['skip'],
                            $batch['fail']
                        ),
                        'details' => [
                            'file' => (string) ($stored['filename'] ?? ''),
                            'ok' => $batch['ok'],
                            'warn' => $batch['warn'],
                            'skip' => $batch['skip'],
                            'fail' => $batch['fail'],
                        ],
                    ]);
                }

                $message = sprintf(
                    '导入完成：成功 %d，带警告 %d，跳过 %d，失败 %d',
                    $batch['ok'],
                    $batch['warn'],
                    $batch['skip'],
                    $batch['fail']
                );
                $message_type = $batch['fail'] > 0 ? 'warning' : 'success';
                $preview = $batch;
            }
        }
    } elseif (!empty($_GET['cancel_preview'])) {
        check_admin_referer('ybb_pr_cancel_preview');
        delete_transient(ybb_pr_import_transient_key(get_current_user_id()));
        $message = '已取消预览';
        $message_type = 'info';
    } else {
        $stored = get_transient(ybb_pr_import_transient_key(get_current_user_id()));
        if (is_array($stored) && !empty($stored['preview'])) {
            $preview = $stored['preview'];
        }
    }

    ?>
    <div class="ybb-pr-import-admin" style="max-width:1200px;">
        <h2>评价 Excel 批量导入</h2>
        <p>上传标准模板（CSV / XLSX），先预览再导入。评价写�?Woo 后前�?strong>无需</strong>重新部署静态站�?/p>

        <div class="notice notice-info inline" style="margin:12px 0;padding:10px 12px;">
            <p><strong>图片 URL 说明</strong></p>
            <ul style="margin:0 0 0 1.2em;list-style:disc;">
                <li><span style="background:#fcf9e8;padding:2px 6px;">黄色�?/span>：Amazon 等外链可能无法从服务器下载；可先把图上传�?<a href="<?php echo esc_url(admin_url('upload.php')); ?>">媒体�?/a>，将 Excel �?URL 改为站内地址后重新导入�?/li>
                <li>站内 URL（如 <code>/wp-content/uploads/...</code>）会优先匹配已有附件，无需重复下载�?/li>
                <li>图片下载失败时评论仍会入库，仅晒图为空�?/li>
            </ul>
        </div>

        <?php if ($message !== '') : ?>
            <div class="notice notice-<?php echo esc_attr($message_type); ?> is-dismissible"><p><?php echo esc_html($message); ?></p></div>
        <?php endif; ?>

        <p>
            <a class="button" href="<?php echo esc_url(add_query_arg(['tab' => 'reviews-import', 'download' => 'template'], admin_url('admin.php?page=ybb-site-manager'))); ?>">下载导入模板 (CSV)</a>
        </p>

        <?php if (!$preview) : ?>
            <form method="post" enctype="multipart/form-data" style="margin-top:16px;">
                <?php wp_nonce_field('ybb_pr_import'); ?>
                <input type="hidden" name="ybb_pr_step" value="preview" />
                <table class="form-table">
                    <tr>
                        <th>导入文件</th>
                        <td>
                            <input type="file" name="import_file" accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
                            <p class="description">最�?<?php echo (int) YBB_PR_IMPORT_MAX_ROWS; ?> 行，5MB 以内�?/p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('预览', 'primary', 'submit', false); ?>
            </form>
        <?php else : ?>
            <?php ybb_pr_import_render_preview_table($preview); ?>
            <?php
            $importable = (int) $preview['ok'] + (int) $preview['warn'];
            $has_pending = is_array(get_transient(ybb_pr_import_transient_key(get_current_user_id())));
            if ($importable > 0 && $has_pending) :
                ?>
                <form method="post" style="margin-top:12px;display:inline-block;">
                    <?php wp_nonce_field('ybb_pr_import'); ?>
                    <input type="hidden" name="ybb_pr_step" value="import" />
                    <?php submit_button('确认导入 ' . $importable . ' 条', 'primary', 'submit', false); ?>
                </form>
            <?php endif; ?>
            <form method="get" style="margin-top:12px;display:inline-block;margin-left:8px;">
                <input type="hidden" name="page" value="ybb-site-manager" />
                <input type="hidden" name="tab" value="reviews-import" />
                <?php wp_nonce_field('ybb_pr_cancel_preview', '_wpnonce', false); ?>
                <input type="hidden" name="cancel_preview" value="1" />
                <?php submit_button('取消 / 重新上传', 'secondary', 'submit', false); ?>
            </form>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * @param array{results: array, ok: int, skip: int, fail: int, warn: int} $preview
 */
function ybb_pr_import_render_preview_table(array $preview): void
{
    $results = $preview['results'] ?? [];
    ?>
    <p>
        预览：可导入 <strong><?php echo (int) $preview['ok'] + (int) $preview['warn']; ?></strong>
        （其中警�?<strong><?php echo (int) $preview['warn']; ?></strong>），
        跳过 <?php echo (int) $preview['skip']; ?>，错�?<?php echo (int) $preview['fail']; ?>�?    </p>
    <table class="widefat striped" style="margin-top:8px;">
        <thead>
        <tr>
            <th>�?/th>
            <th>状�?/th>
            <th>商品</th>
            <th>作�?/th>
            <th>星级</th>
            <th>正文（摘要）</th>
            <th>图片探测</th>
            <th>说明</th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($results as $item) :
            $status = (string) ($item['row_status'] ?? '');
            $row = $item['row'] ?? [];
            switch ($status) {
                case 'error':
                    $bg = '#fde8e8';
                    break;
                case 'skip':
                    $bg = '#f3f4f6';
                    break;
                case 'warn':
                    $bg = '#fcf9e8';
                    break;
                default:
                    $bg = '#f0fdf4';
                    break;
            }
            $product = $item['product'] ?? null;
            $img_lines = [];
            foreach ($item['image_probes'] ?? [] as $n => $probe) {
                if (!is_array($probe) || ($probe['status'] ?? '') === 'empty') {
                    continue;
                }
                $img_lines[] = '图 ' . $n . ': ' . ($probe['message'] ?? '');
            }
            if (!empty($item['images_failed'])) {
                foreach ($item['images_failed'] as $fail) {
                    $img_lines[] = $fail;
                }
            }
            $notes = array_merge($item['warnings'] ?? [], $item['errors'] ?? []);
            ?>
            <tr style="background:<?php echo esc_attr($bg); ?>;">
                <td><?php echo (int) ($item['line'] ?? 0); ?></td>
                <td><?php echo esc_html($status); ?></td>
                <td>
                    <?php if (is_array($product)) : ?>
                        #<?php echo (int) $product['product_id']; ?>
                        <br><small><?php echo esc_html((string) $product['title']); ?></small>
                    <?php else : ?>
                        �?                    <?php endif; ?>
                </td>
                <td><?php echo esc_html((string) ($row['author'] ?? '')); ?></td>
                <td><?php echo esc_html((string) ($row['rating'] ?? '')); ?></td>
                <td><?php echo esc_html(mb_substr((string) ($row['content'] ?? ''), 0, 80)); ?>�?/td>
                <td><small><?php echo esc_html(implode("\n", $img_lines)); ?></small></td>
                <td><small><?php echo esc_html(implode('； ', $notes)); ?></small></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
}

function ybb_pr_import_send_template(): void
{
    $headers = [
        'product_handle',
        'product_sku',
        'wc_product_id',
        'author',
        'email',
        'rating',
        'content',
        'date',
        'image_url_1',
        'image_url_2',
        'image_url_3',
        'status',
        'source_note',
    ];

    $example = [
        'tz-hk-001',
        'TZ-HK-001',
        '50689',
        'Example Buyer',
        'buyer@review.import',
        '5',
        'Great hooks, very sharp.',
        '2026-06-21',
        'https://carp-ybb.com/wp-content/uploads/example.jpg',
        '',
        '',
        'approved',
        '示例行，导入前请删除',
    ];

    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="product-reviews-import-template.csv"');

    echo "\xEF\xBB\xBF";
    $out = fopen('php://output', 'w');
    fputcsv($out, $headers);
    fputcsv($out, $example);
    fclose($out);
    exit;
}

function ybb_pr_import_register_site_manager_hooks(): void
{
    add_filter('ybb_sm_admin_allowed_tabs', static function (array $tabs): array {
        $tabs[] = 'reviews-import';

        return $tabs;
    });

    add_filter('ybb_sm_admin_tab_labels', static function (array $labels): array {
        $labels['reviews-import'] = '评价导入';

        return $labels;
    });

    add_action('ybb_sm_admin_render_tab_reviews-import', 'ybb_pr_render_import_admin_page');
}

function ybb_pr_import_register_fallback_menu(): void
{
    add_submenu_page(
        'woocommerce',
        '批量评价导入',
        '批量评价导入',
        'manage_options',
        'ybb-reviews-import',
        'ybb_pr_render_import_admin_page'
    );
}

add_action('plugins_loaded', static function (): void {
    if (!function_exists('ybb_pr_import_parse_uploaded_file')) {
        return;
    }
    ybb_pr_import_register_site_manager_hooks();
    if (!defined('YBB_SM_VERSION')) {
        ybb_pr_import_register_fallback_menu();
    }
}, 30);
