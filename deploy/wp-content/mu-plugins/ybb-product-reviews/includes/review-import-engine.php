<?php

if (!defined('ABSPATH')) {
    exit;
}

const YBB_PR_IMPORT_MAX_ROWS = 200;
const YBB_PR_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

function ybb_pr_import_normalize_header(string $header): string
{
    $header = strtolower(trim($header));
    $header = str_replace(['-', ' '], '_', $header);

    return $header;
}

/** @return string[] */
function ybb_pr_import_expected_columns(): array
{
    return [
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
}

/**
 * @return array{status: string, message: string, http_code?: int, attachment_id?: int}
 */
function ybb_pr_import_probe_image_url(string $url): array
{
    $url = trim($url);
    if ($url === '') {
        return ['status' => 'empty', 'message' => ''];
    }

    if (!preg_match('#^https?://#i', $url)) {
        $url = home_url($url);
    }

    $host = (string) wp_parse_url($url, PHP_URL_HOST);
    $site_host = (string) wp_parse_url(home_url(), PHP_URL_HOST);
    $is_amazon = $host !== '' && (
        stripos($host, 'amazon.') !== false
        || stripos($host, 'media-amazon.com') !== false
        || stripos($host, 'ssl-images-amazon') !== false
    );

    if ($host !== '' && $site_host !== '' && strcasecmp($host, $site_host) === 0) {
        $attachment_id = (int) attachment_url_to_postid($url);

        return [
            'status' => 'ok_local',
            'message' => $attachment_id > 0
                ? '站内媒体库 URL（已匹配附件 #' . $attachment_id . '）'
                : '站内 URL，导入时将 sideload',
            'attachment_id' => $attachment_id,
        ];
    }

    $response = wp_remote_head($url, [
        'timeout' => 12,
        'redirection' => 3,
        'user-agent' => 'YBB-Review-Import/1.2',
    ]);

    $code = is_wp_error($response) ? 0 : (int) wp_remote_retrieve_response_code($response);
    $reachable = !is_wp_error($response) && $code >= 200 && $code < 400;

    if (!$reachable) {
        $err = is_wp_error($response) ? $response->get_error_message() : 'HTTP ' . $code;

        return [
            'status' => $is_amazon ? 'warn_amazon_blocked' : 'warn_unreachable',
            'message' => $is_amazon
                ? 'Amazon 外链可能被服务器 IP 拒绝（' . $err . '）；请上传到媒体库后改用站内 URL 重导'
                : '图片 URL 无法访问（' . $err . '）',
            'http_code' => $code,
        ];
    }

    if ($is_amazon) {
        return [
            'status' => 'warn_amazon',
            'message' => 'Amazon 外链：HEAD 可达，sideload 仍可能失败；建议改为站内媒体库 URL',
            'http_code' => $code,
        ];
    }

    return [
        'status' => 'ok',
        'message' => '远程 URL 可访问',
        'http_code' => $code,
    ];
}

/**
 * @param array<int, string> $row
 * @param array<int, string> $headers
 * @return array<string, string>
 */
function ybb_pr_import_map_row(array $row, array $headers): array
{
    $mapped = [];
    foreach ($headers as $index => $header) {
        $key = ybb_pr_import_normalize_header((string) $header);
        if ($key === '') {
            continue;
        }
        $mapped[$key] = trim((string) ($row[$index] ?? ''));
    }

    return $mapped;
}

/**
 * @return array{rows: array<int, array<string, string>>, errors: string[]}
 */
function ybb_pr_import_parse_csv(string $path): array
{
    $errors = [];
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        return ['rows' => [], 'errors' => ['无法读取 CSV 文件']];
    }

    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") {
        rewind($handle);
    }

    $header_row = fgetcsv($handle);
    if (!is_array($header_row)) {
        fclose($handle);

        return ['rows' => [], 'errors' => ['CSV 缺少表头']];
    }

    $headers = array_map('ybb_pr_import_normalize_header', $header_row);
    $rows = [];
    while (($data = fgetcsv($handle)) !== false) {
        if ($data === [null] || $data === false) {
            continue;
        }
        $mapped = ybb_pr_import_map_row($data, $headers);
        if (ybb_pr_import_row_is_blank($mapped)) {
            continue;
        }
        $rows[] = $mapped;
    }
    fclose($handle);

    if (count($rows) > YBB_PR_IMPORT_MAX_ROWS) {
        $errors[] = '超过单次上限 ' . YBB_PR_IMPORT_MAX_ROWS . ' 行';

        return ['rows' => [], 'errors' => $errors];
    }

    return ['rows' => $rows, 'errors' => $errors];
}

/**
 * @return array{rows: array<int, array<string, string>>, errors: string[]}
 */
function ybb_pr_import_parse_xlsx(string $path): array
{
    $lib = dirname(__DIR__) . '/lib/SimpleXLSX.php';
    if (!is_readable($lib)) {
        return ['rows' => [], 'errors' => ['缺少 SimpleXLSX 库，请改用 CSV 或重新上传插件目录']];
    }
    require_once $lib;

    if (!class_exists('Shuchkin\\SimpleXLSX')) {
        return ['rows' => [], 'errors' => ['SimpleXLSX 类未加载']];
    }

    $xlsx = \Shuchkin\SimpleXLSX::parse($path);

    if (!$xlsx) {
        return ['rows' => [], 'errors' => ['XLSX 解析失败']];
    }

    $sheet_rows = $xlsx->rows();
    if (!is_array($sheet_rows) || $sheet_rows === []) {
        return ['rows' => [], 'errors' => ['XLSX 为空']];
    }

    $header_row = array_shift($sheet_rows);
    $headers = array_map(
        static fn ($h) => ybb_pr_import_normalize_header((string) $h),
        $header_row
    );

    $rows = [];
    foreach ($sheet_rows as $data) {
        if (!is_array($data)) {
            continue;
        }
        $mapped = ybb_pr_import_map_row($data, $headers);
        if (ybb_pr_import_row_is_blank($mapped)) {
            continue;
        }
        $rows[] = $mapped;
    }

    if (count($rows) > YBB_PR_IMPORT_MAX_ROWS) {
        return ['rows' => [], 'errors' => ['超过单次上限 ' . YBB_PR_IMPORT_MAX_ROWS . ' 行']];
    }

    return ['rows' => $rows, 'errors' => []];
}

/**
 * @param array<string, string> $row
 */
function ybb_pr_import_row_is_blank(array $row): bool
{
    foreach (['author', 'content', 'product_handle', 'product_sku', 'wc_product_id'] as $key) {
        if (!empty($row[$key])) {
            return false;
        }
    }

    return true;
}

/**
 * @param array<string, string> $row
 * @return array{product_id: int, title: string, note?: string}|WP_Error
 */
function ybb_pr_import_resolve_product(array $row)
{
    $wc_id = (int) ($row['wc_product_id'] ?? 0);
    if ($wc_id > 0) {
        $post = get_post($wc_id);
        if (!$post || $post->post_type !== 'product') {
            return new WP_Error('invalid_product', 'wc_product_id ' . $wc_id . ' 不是有效商品');
        }
        if (function_exists('wc_get_product')) {
            $product = wc_get_product($wc_id);
            if ($product && $product->is_type('variation') && $product->get_parent_id()) {
                $parent_id = (int) $product->get_parent_id();
                $parent = wc_get_product($parent_id);

                return [
                    'product_id' => $parent_id,
                    'title' => $parent ? $parent->get_name() : get_the_title($parent_id),
                    'note' => '变体 ID 已映射到父商品 #' . $parent_id,
                ];
            }
        }

        return ['product_id' => $wc_id, 'title' => get_the_title($wc_id)];
    }

    $sku = strtoupper(trim((string) ($row['product_sku'] ?? '')));
    if ($sku !== '' && function_exists('wc_get_product_id_by_sku')) {
        $found = (int) wc_get_product_id_by_sku($sku);
        if ($found > 0) {
            if (function_exists('wc_get_product')) {
                $product = wc_get_product($found);
                if ($product && $product->is_type('variation') && $product->get_parent_id()) {
                    $parent_id = (int) $product->get_parent_id();

                    return [
                        'product_id' => $parent_id,
                        'title' => get_the_title($parent_id),
                        'note' => '变体 SKU 已映射到父商品',
                    ];
                }
            }

            return ['product_id' => $found, 'title' => get_the_title($found)];
        }

        return new WP_Error('sku_not_found', '未找到 SKU：' . $sku);
    }

    $handle = sanitize_title((string) ($row['product_handle'] ?? ''));
    if ($handle !== '') {
        if (function_exists('ybb_home_wc_find_product_by_handle')) {
            $product = ybb_home_wc_find_product_by_handle($handle);
            if ($product instanceof WC_Product) {
                return ['product_id' => $product->get_id(), 'title' => $product->get_name()];
            }
        }

        $posts = get_posts([
            'post_type' => 'product',
            'name' => $handle,
            'posts_per_page' => 1,
            'post_status' => 'any',
        ]);
        if ($posts) {
            return ['product_id' => (int) $posts[0]->ID, 'title' => $posts[0]->post_title];
        }

        return new WP_Error('handle_not_found', '未找到 handle：' . $handle);
    }

    return new WP_Error('missing_product', '请填写 wc_product_id、product_sku 或 product_handle 之一');
}

function ybb_pr_import_content_fingerprint(string $content): string
{
    return substr(wp_strip_all_tags($content), 0, 80);
}

function ybb_pr_import_row_exists(int $product_id, string $author, string $content): bool
{
    $comments = get_comments([
        'post_id' => $product_id,
        'type' => 'review',
        'status' => 'all',
        'number' => 500,
    ]);

    $fp = ybb_pr_import_content_fingerprint($content);
    $author = trim($author);

    foreach ($comments as $comment) {
        if (trim((string) $comment->comment_author) !== $author) {
            continue;
        }
        if (ybb_pr_import_content_fingerprint((string) $comment->comment_content) === $fp) {
            return true;
        }
    }

    return false;
}

/**
 * @param array<string, string> $row
 * @return array{row_status: string, errors: string[], warnings: string[], image_probes: array<int, array>, product?: array}
 */
function ybb_pr_import_validate_row(array $row, int $line): array
{
    $errors = [];
    $warnings = [];
    $image_probes = [];

    $resolved = ybb_pr_import_resolve_product($row);
    if (is_wp_error($resolved)) {
        return [
            'row_status' => 'error',
            'errors' => [$resolved->get_error_message()],
            'warnings' => [],
            'image_probes' => [],
        ];
    }

    if (!empty($resolved['note'])) {
        $warnings[] = (string) $resolved['note'];
    }

    $author = trim((string) ($row['author'] ?? ''));
    $email = trim((string) ($row['email'] ?? ''));
    $content = trim((string) ($row['content'] ?? ''));
    $rating = (int) ($row['rating'] ?? 0);

    if ($author === '') {
        $errors[] = '缺少 author';
    }
    if ($email === '' || !is_email($email)) {
        $errors[] = 'email 无效';
    }
    if ($content === '') {
        $errors[] = '缺少 content';
    }
    if ($rating < 1 || $rating > 5) {
        $errors[] = 'rating 须为 1–5';
    }

    if ($errors === [] && ybb_pr_import_row_exists($resolved['product_id'], $author, $content)) {
        return [
            'row_status' => 'skip',
            'errors' => [],
            'warnings' => ['已存在相同作者与正文，将跳过'],
            'image_probes' => [],
            'product' => $resolved,
        ];
    }

    foreach ([1, 2, 3] as $n) {
        $key = 'image_url_' . $n;
        $url = trim((string) ($row[$key] ?? ''));
        if ($url === '') {
            continue;
        }
        $probe = ybb_pr_import_probe_image_url($url);
        $image_probes[$n] = $probe;
        if (in_array($probe['status'], ['warn_amazon', 'warn_amazon_blocked', 'warn_unreachable'], true)) {
            $warnings[] = '图 ' . $n . '：' . $probe['message'];
        }
    }

    if ($errors !== []) {
        return [
            'row_status' => 'error',
            'errors' => $errors,
            'warnings' => $warnings,
            'image_probes' => $image_probes,
            'product' => $resolved,
        ];
    }

    $row_status = $warnings !== [] ? 'warn' : 'ok';

    return [
        'row_status' => $row_status,
        'errors' => [],
        'warnings' => $warnings,
        'image_probes' => $image_probes,
        'product' => $resolved,
    ];
}

function ybb_pr_import_sideload_image_url(string $url, int $product_id, string $comment_status)
{
    $url = trim($url);
    if ($url === '') {
        return new WP_Error('empty_url', 'Empty image URL');
    }

    if (!preg_match('#^https?://#i', $url)) {
        $url = home_url($url);
    }

    $probe = ybb_pr_import_probe_image_url($url);
    if (!empty($probe['attachment_id']) && (int) $probe['attachment_id'] > 0) {
        return (int) $probe['attachment_id'];
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $tmp = download_url($url, 30);
    if (is_wp_error($tmp)) {
        return new WP_Error(
            'download_failed',
            '下载图片失败：' . $tmp->get_error_message()
        );
    }

    $path = wp_parse_url($url, PHP_URL_PATH);
    $filename = $path ? basename((string) $path) : 'review-image.jpg';
    if ($filename === '' || $filename === '/') {
        $filename = 'review-image.jpg';
    }

    $file_array = [
        'name' => sanitize_file_name($filename),
        'tmp_name' => $tmp,
    ];

    $valid = ybb_product_reviews_validate_image_file([
        'name' => $file_array['name'],
        'type' => '',
        'tmp_name' => $tmp,
        'error' => UPLOAD_ERR_OK,
        'size' => (int) @filesize($tmp),
    ]);
    if (is_wp_error($valid)) {
        @unlink($tmp);

        return $valid;
    }

    $attachment_id = media_handle_sideload($file_array, $product_id);
    if (is_wp_error($attachment_id)) {
        @unlink($tmp);

        return $attachment_id;
    }

    $status = $comment_status === '1' ? 'inherit' : 'pending';
    wp_update_post([
        'ID' => (int) $attachment_id,
        'post_status' => $status,
    ]);

    return (int) $attachment_id;
}

/**
 * @param array<string, string> $row
 * @return array{comment_id?: int, images_ok: int, images_failed: string[], dry_run?: bool}|WP_Error
 */
function ybb_pr_import_insert_row(array $row, int $product_id, bool $dry_run = false)
{
    $validation = ybb_pr_import_validate_row($row, 0);
    if ($validation['row_status'] === 'error') {
        return new WP_Error('validation', implode('; ', $validation['errors']));
    }
    if ($validation['row_status'] === 'skip') {
        return new WP_Error('skip', 'duplicate');
    }

    if ($dry_run) {
        return ['dry_run' => true, 'images_ok' => 0, 'images_failed' => []];
    }

    $status = strtolower(trim((string) ($row['status'] ?? 'approved')));
    $approved = $status === 'hold' ? 0 : 1;

    $date_raw = trim((string) ($row['date'] ?? ''));
    if ($date_raw !== '') {
        $timestamp = strtotime($date_raw);
        $local_date = $timestamp ? gmdate('Y-m-d H:i:s', $timestamp + (get_option('gmt_offset') * HOUR_IN_SECONDS)) : current_time('mysql');
        $gmt_date = $timestamp ? gmdate('Y-m-d H:i:s', $timestamp) : current_time('mysql', 1);
    } else {
        $local_date = current_time('mysql');
        $gmt_date = current_time('mysql', 1);
    }

    $comment_id = wp_insert_comment([
        'comment_post_ID' => $product_id,
        'comment_author' => sanitize_text_field((string) $row['author']),
        'comment_author_email' => sanitize_email((string) $row['email']),
        'comment_content' => wp_kses_post((string) $row['content']),
        'comment_type' => 'review',
        'comment_approved' => $approved,
        'comment_date' => $local_date,
        'comment_date_gmt' => $gmt_date,
        'user_id' => 0,
    ]);

    if (!$comment_id) {
        return new WP_Error('insert_failed', 'wp_insert_comment 失败');
    }

    update_comment_meta((int) $comment_id, 'rating', max(1, min(5, (int) ($row['rating'] ?? 5))));

    $attachment_ids = [];
    $images_failed = [];
    $comment_status = $approved ? '1' : '0';

    foreach ([1, 2, 3] as $n) {
        $url = trim((string) ($row['image_url_' . $n] ?? ''));
        if ($url === '') {
            continue;
        }
        $uploaded = ybb_pr_import_sideload_image_url($url, $product_id, $comment_status);
        if (is_wp_error($uploaded)) {
            $images_failed[] = '图 ' . $n . '：' . $uploaded->get_error_message();
            continue;
        }
        $attachment_ids[] = $uploaded;
    }

    if ($attachment_ids !== []) {
        update_comment_meta((int) $comment_id, 'ybb_review_images', $attachment_ids);
    }

    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients($product_id);
    }

    return [
        'comment_id' => (int) $comment_id,
        'images_ok' => count($attachment_ids),
        'images_failed' => $images_failed,
    ];
}

/**
 * @param array<int, array<string, string>> $rows
 * @return array{results: array<int, array>, ok: int, skip: int, fail: int, warn: int}
 */
function ybb_pr_import_batch(array $rows, bool $dry_run = false): array
{
    $results = [];
    $ok = 0;
    $skip = 0;
    $fail = 0;
    $warn = 0;

    foreach ($rows as $index => $row) {
        $line = $index + 2;
        $validation = ybb_pr_import_validate_row($row, $line);

        if ($validation['row_status'] === 'error') {
            $fail++;
            $results[] = array_merge(['line' => $line, 'row' => $row], $validation);
            continue;
        }

        if ($validation['row_status'] === 'skip') {
            $skip++;
            $results[] = array_merge(['line' => $line, 'row' => $row], $validation);
            continue;
        }

        if ($dry_run) {
            if ($validation['row_status'] === 'warn') {
                $warn++;
            } else {
                $ok++;
            }
            $results[] = array_merge(['line' => $line, 'row' => $row], $validation);
            continue;
        }

        $product_id = (int) ($validation['product']['product_id'] ?? 0);
        $inserted = ybb_pr_import_insert_row($row, $product_id, false);
        if (is_wp_error($inserted)) {
            if ($inserted->get_error_code() === 'skip') {
                $skip++;
                $validation['row_status'] = 'skip';
            } else {
                $fail++;
                $validation['row_status'] = 'error';
                $validation['errors'][] = $inserted->get_error_message();
            }
            $results[] = array_merge(['line' => $line, 'row' => $row], $validation);
            continue;
        }

        $validation['comment_id'] = $inserted['comment_id'];
        $validation['images_ok'] = $inserted['images_ok'];
        $validation['images_failed'] = $inserted['images_failed'];
        if ($validation['images_failed'] !== []) {
            $validation['warnings'] = array_merge($validation['warnings'] ?? [], $inserted['images_failed']);
            $validation['row_status'] = 'warn';
            $warn++;
        } else {
            if ($validation['row_status'] === 'warn') {
                $warn++;
            } else {
                $ok++;
            }
        }
        $results[] = array_merge(['line' => $line, 'row' => $row], $validation);
    }

    return compact('results', 'ok', 'skip', 'fail', 'warn');
}

/**
 * @return array{rows: array, errors: string[], file_hash: string}
 */
function ybb_pr_import_parse_uploaded_file(array $file): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['rows' => [], 'errors' => ['文件上传失败'], 'file_hash' => ''];
    }
    if ((int) ($file['size'] ?? 0) > YBB_PR_IMPORT_MAX_BYTES) {
        return ['rows' => [], 'errors' => ['文件超过 5MB 上限'], 'file_hash' => ''];
    }

    $name = (string) ($file['name'] ?? '');
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['csv', 'xlsx'], true)) {
        return ['rows' => [], 'errors' => ['仅支持 .csv 或 .xlsx'], 'file_hash' => ''];
    }

    $tmp = (string) ($file['tmp_name'] ?? '');
    $file_hash = @hash_file('sha256', $tmp) ?: '';

    $parsed = $ext === 'csv'
        ? ybb_pr_import_parse_csv($tmp)
        : ybb_pr_import_parse_xlsx($tmp);

    return [
        'rows' => $parsed['rows'],
        'errors' => $parsed['errors'],
        'file_hash' => $file_hash,
    ];
}
