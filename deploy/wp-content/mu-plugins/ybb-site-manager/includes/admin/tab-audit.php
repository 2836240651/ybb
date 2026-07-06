<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_admin_tab_audit(): void
{
    $category = sanitize_key($_GET['audit_category'] ?? 'all');
    $status = sanitize_key($_GET['audit_status'] ?? 'all');
    $days = max(0, (int) ($_GET['audit_days'] ?? 30));
    $page = max(1, (int) ($_GET['audit_page'] ?? 1));

    $result = ybb_sm_audit_query([
        'category' => $category,
        'status' => $status,
        'days' => $days,
        'page' => $page,
        'per_page' => 50,
    ]);

    $baseUrl = add_query_arg(['page' => 'ybb-site-manager', 'tab' => 'audit'], admin_url('admin.php'));
    $exportUrl = wp_nonce_url(
        add_query_arg([
            'action' => 'ybb_sm_export_audit',
            'category' => $category,
            'status' => $status,
            'days' => $days,
        ], admin_url('admin-post.php')),
        'ybb_sm_export_audit'
    );

    $statusIcons = [
        'success' => '�?,
        'failed' => '�?,
        'running' => '�?,
        'warning' => '⚠️',
        'info' => 'ℹ️',
    ];
    ?>
    <div class="ybb-sm-audit" style="margin-top:16px;">
        <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:16px;">
            <input type="hidden" name="page" value="ybb-site-manager" />
            <input type="hidden" name="tab" value="audit" />
            <label>类别
                <select name="audit_category">
                    <option value="all" <?php selected($category, 'all'); ?>>全部</option>
                    <option value="config" <?php selected($category, 'config'); ?>>配置</option>
                    <option value="deploy" <?php selected($category, 'deploy'); ?>>部署</option>
                    <option value="system" <?php selected($category, 'system'); ?>>系统</option>
                </select>
            </label>
            <label>状�?                <select name="audit_status">
                    <option value="all" <?php selected($status, 'all'); ?>>全部</option>
                    <option value="success" <?php selected($status, 'success'); ?>>成功</option>
                    <option value="failed" <?php selected($status, 'failed'); ?>>失败</option>
                    <option value="running" <?php selected($status, 'running'); ?>>进行�?/option>
                    <option value="warning" <?php selected($status, 'warning'); ?>>警告</option>
                </select>
            </label>
            <label>时间
                <select name="audit_days">
                    <option value="7" <?php selected($days, 7); ?>>�?7 �?/option>
                    <option value="30" <?php selected($days, 30); ?>>�?30 �?/option>
                    <option value="90" <?php selected($days, 90); ?>>�?90 �?/option>
                    <option value="0" <?php selected($days, 0); ?>>全部</option>
                </select>
            </label>
            <?php submit_button('筛�?, 'secondary', 'submit', false); ?>
            <a class="button" href="<?php echo esc_url($exportUrl); ?>">导出 CSV</a>
        </form>

        <p class="description">�?<?php echo (int) $result['total']; ?> 条记录（保留最�?<?php echo (int) YBB_SM_AUDIT_MAX_ENTRIES; ?> �?/ <?php echo (int) YBB_SM_AUDIT_RETENTION_DAYS; ?> 天）。配置类保存后无需部署即可生效；部署类需等待 Runner 完成�?/p>

        <table class="widefat striped">
            <thead>
                <tr>
                    <th style="width:150px;">时间</th>
                    <th style="width:90px;">操作�?/th>
                    <th style="width:80px;">模块</th>
                    <th style="width:50px;">状�?/th>
                    <th>摘要</th>
                    <th style="width:70px;">详情</th>
                </tr>
            </thead>
            <tbody>
            <?php if (empty($result['items'])) : ?>
                <tr><td colspan="6">暂无记录。保存任�?Tab 或触发部署后会出现�?/td></tr>
            <?php else : ?>
                <?php foreach ($result['items'] as $row) :
                    $st = $row['status'] ?? 'info';
                    $icon = $statusIcons[$st] ?? '·';
                    $at = $row['at'] ?? '';
                    $atLocal = $at !== '' ? wp_date('Y-m-d H:i', strtotime($at)) : '�?;
                    $detailId = 'ybb-audit-detail-' . esc_attr($row['id'] ?? uniqid());
                    $detailLines = !empty($row['detail']) ? explode("\n", (string) $row['detail']) : [];
                    $changeLines = array_values(array_filter($detailLines, static function ($line) {
                        return (bool) preg_match('/^  [·+\-]/u', $line);
                    }));
                    ?>
                    <tr>
                        <td><?php echo esc_html($atLocal); ?></td>
                        <td><?php echo esc_html($row['actor'] ?? '�?); ?></td>
                        <td><?php echo esc_html($row['moduleLabel'] ?? ''); ?></td>
                        <td title="<?php echo esc_attr($st); ?>"><?php echo esc_html($icon); ?></td>
                        <td>
                            <?php echo esc_html($row['summary'] ?? ''); ?>
                            <?php if ($changeLines !== []) : ?>
                                <ul class="ybb-audit-changes" style="margin:6px 0 0;padding-left:18px;color:#1d2327;font-size:12px;list-style:disc;">
                                    <?php foreach (array_slice($changeLines, 0, 8) as $changeLine) : ?>
                                        <li><?php echo esc_html(trim((string) preg_replace('/^  [·+\-]\s*/u', '', $changeLine))); ?></li>
                                    <?php endforeach; ?>
                                    <?php if (count($changeLines) > 8) : ?>
                                        <li style="color:#666;">�?另有 <?php echo (int) (count($changeLines) - 8); ?> 处，点「展开」查�?/li>
                                    <?php endif; ?>
                                </ul>
                            <?php endif; ?>
                            <?php if (!empty($row['nextStep'])) : ?>
                                <br /><span style="color:#666;font-size:12px;">下一步：<?php echo esc_html($row['nextStep']); ?></span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!empty($row['detail'])) : ?>
                                <button type="button" class="button button-small" onclick="var el=document.getElementById('<?php echo $detailId; ?>');el.style.display=el.style.display==='none'?'block':'none';">展开</button>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php if (!empty($row['detail'])) : ?>
                    <tr id="<?php echo $detailId; ?>" style="display:none;">
                        <td colspan="6"><pre style="white-space:pre-wrap;margin:0;font-size:12px;background:#f6f7f7;padding:8px;"><?php echo esc_html($row['detail']); ?></pre></td>
                    </tr>
                    <?php endif; ?>
                <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
        </table>

        <?php if ($result['pages'] > 1) : ?>
            <p class="tablenav" style="margin-top:12px;">
                <?php for ($p = 1; $p <= $result['pages']; $p++) :
                    $url = add_query_arg([
                        'audit_category' => $category,
                        'audit_status' => $status,
                        'audit_days' => $days,
                        'audit_page' => $p,
                    ], $baseUrl);
                    if ($p === $page) : ?>
                        <strong style="margin-right:8px;"><?php echo (int) $p; ?></strong>
                    <?php else : ?>
                        <a href="<?php echo esc_url($url); ?>" style="margin-right:8px;"><?php echo (int) $p; ?></a>
                    <?php endif;
                endfor; ?>
            </p>
        <?php endif; ?>
    </div>
    <?php
}
