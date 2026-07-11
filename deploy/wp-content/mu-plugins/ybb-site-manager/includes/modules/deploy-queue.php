<?php

if (!defined('ABSPATH')) {
    exit;
}

const YBB_SM_DEPLOY_DEBOUNCE_SEC = 300;

function ybb_sm_deploy_get(): array
{
    $deploy = ybb_sm_get_module('deploy');
    $defaults = ybb_sm_default_module('deploy');

    return array_replace($defaults, is_array($deploy) ? $deploy : []);
}

function ybb_sm_deploy_save(array $deploy): void
{
    $all = ybb_sm_get_all();
    $all['deploy'] = array_replace($all['deploy'] ?? [], $deploy);
    update_option(YBB_SM_OPTION, $all);
}

function ybb_sm_deploy_queue(string $trigger = 'manual'): void
{
    $deploy = ybb_sm_deploy_get();
    $now = time();
    $pendingUntil = (int) ($deploy['pendingUntil'] ?? 0);
    if ($pendingUntil > $now) {
        ybb_sm_deploy_save([
            'pending' => true,
            'trigger' => $trigger,
            'pendingUntil' => $pendingUntil,
        ]);
        if (function_exists('ybb_sm_audit_log_deploy_event')) {
            ybb_sm_audit_log_deploy_event(
                'deploy_merge',
                'info',
                '已合并到进行中的部署任务：' . ybb_sm_audit_trigger_label($trigger) . '】',
                ['trigger' => $trigger],
                '防抖窗口内多次触发仅执行一次部署。',
                '约 ' . max(1, (int) ceil(($pendingUntil - $now) / 60)) . ' 分钟后 Runner 开始'
            );
        }

        return;
    }

    ybb_sm_deploy_save([
        'state' => 'pending',
        'pending' => true,
        'pendingUntil' => $now + YBB_SM_DEPLOY_DEBOUNCE_SEC,
        'trigger' => $trigger,
        'lastError' => '',
    ]);
    if (function_exists('ybb_sm_audit_log_deploy_event')) {
        $mins = (int) ceil(YBB_SM_DEPLOY_DEBOUNCE_SEC / 60);
        ybb_sm_audit_log_deploy_event(
            'deploy_queue',
            'running',
            '已加入部署队列（' . ybb_sm_audit_trigger_label($trigger) . '），约 ' . $mins . ' 分钟后执行',
            ['trigger' => $trigger],
            '',
            '可在「部署状态」查看进度；完成后刷新产品页'
        );
    }
}

function ybb_sm_deploy_status_public(bool $checkPending = false): array
{
    $deploy = ybb_sm_deploy_get();
    $now = time();
    $pendingUntil = (int) ($deploy['pendingUntil'] ?? 0);

    if ($checkPending && !empty($deploy['pending']) && $pendingUntil > 0 && $now >= $pendingUntil) {
        return array_merge($deploy, ['readyToRun' => true]);
    }

    return array_merge($deploy, ['readyToRun' => !empty($deploy['pending']) && $pendingUntil > 0 && $now >= $pendingUntil]);
}

function ybb_sm_deploy_verify_key(WP_REST_Request $request): bool
{
    $deploy = ybb_sm_deploy_get();
    $secret = (string) ($deploy['secret'] ?? '');
    if ($secret === '') {
        return false;
    }
    $key = $request->get_header('X-YBB-Deploy-Key');
    if (!$key) {
        $key = $request->get_param('key');
    }

    return is_string($key) && hash_equals($secret, $key);
}

function ybb_sm_deploy_claim(): bool
{
    $deploy = ybb_sm_deploy_get();
    if (empty($deploy['pending']) || ($deploy['state'] ?? '') === 'running') {
        return false;
    }
    ybb_sm_deploy_save([
        'state' => 'running',
        'startedAt' => gmdate('c'),
    ]);
    if (function_exists('ybb_sm_audit_log_deploy_event')) {
        $trigger = (string) ($deploy['trigger'] ?? 'manual');
        ybb_sm_audit_log_deploy_event(
            'deploy_start',
            'running',
            '正在同步产品并重建静态站…',
            ['trigger' => $trigger],
            'Runner 已认领任务：' . ybb_sm_audit_trigger_label($trigger)
        );
    }

    return true;
}

function ybb_sm_deploy_complete(string $state, string $buildId = '', string $error = ''): void
{
    ybb_sm_deploy_save([
        'state' => $state,
        'pending' => false,
        'pendingUntil' => null,
        'lastBuildId' => $buildId !== '' ? $buildId : (ybb_sm_deploy_get()['lastBuildId'] ?? ''),
        'lastError' => $error,
        'finishedAt' => gmdate('c'),
        'currentStep' => '',
        'currentStepLabel' => '',
        'currentStepAt' => null,
    ]);
}

add_action('transition_post_status', function ($new, $old, $post) {
    if ($new !== 'publish' || $post->post_type !== 'product') {
        return;
    }
    if ($old === 'publish' && $new === 'publish') {
        return;
    }
    ybb_sm_deploy_queue('product_publish');
}, 10, 3);

add_action('save_post_product', function ($postId) {
    if (wp_is_post_revision($postId) || wp_is_post_autosave($postId)) {
        return;
    }
    $post = get_post($postId);
    if (!$post || $post->post_status !== 'publish') {
        return;
    }
    ybb_sm_deploy_queue('product_update');
}, 20);

add_action('admin_notices', function () {
    if (!current_user_can('manage_options')) {
        return;
    }
    $deploy = ybb_sm_deploy_get();
    if (($deploy['state'] ?? '') === 'failed' && !empty($deploy['lastError'])) {
        echo '<div class="notice notice-error"><p><strong>YBB Deploy:</strong> ' . esc_html($deploy['lastError']) . '</p></div>';
    }
});
