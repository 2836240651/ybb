#!/usr/bin/env python3
"""Fix PHP parse errors in page.php deploy tab (encoding corruption)."""
from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"
)

DEPLOY_FUNC = r'''function ybb_sm_admin_tab_deploy(array $all): void
{
    $deploy = $all['deploy'] ?? ybb_sm_deploy_get();
    $statusUrl = esc_url(rest_url('ybb/v1/deploy/status'));
    $dash = '—';
    ?>
    <div style="margin-top:16px;" id="ybb-sm-deploy-panel">
        <p class="description" style="max-width:720px;">
            <strong>说明：</strong>后台「入队」只写入 WordPress；真正同步 Woo 图片、重建静态页、上传 SiteGround 需本机 Runner
            <code>scripts/ybb-deploy-runner.ps1 -Poll</code>（或任务计划每 5 分钟）认领执行。
            操作记录中<strong>入队</strong>即写入；本页状态在 Runner 认领后才会变为 <code>running</code>。
        </p>
        <table class="form-table" id="ybb-sm-deploy-status-table">
            <tr><th>状态</th><td><code id="ybb-deploy-state"><?php echo esc_html($deploy['state'] ?? 'idle'); ?></code></td></tr>
            <tr><th>Pending</th><td id="ybb-deploy-pending"><?php echo !empty($deploy['pending']) ? '是' : '否'; ?></td></tr>
            <tr><th>触发来源</th><td id="ybb-deploy-trigger"><?php echo esc_html($deploy['trigger'] ?? $dash); ?></td></tr>
            <tr><th>计划执行</th><td id="ybb-deploy-pending-until"><?php echo !empty($deploy['pendingUntil']) ? esc_html(wp_date('Y-m-d H:i:s', (int) $deploy['pendingUntil'])) : $dash; ?></td></tr>
            <tr><th>当前步骤</th><td id="ybb-deploy-step"><?php echo esc_html($deploy['currentStepLabel'] ?? $dash); ?></td></tr>
            <tr><th>开始时间</th><td id="ybb-deploy-started"><?php echo esc_html($deploy['startedAt'] ?? $dash); ?></td></tr>
            <tr><th>完成时间</th><td id="ybb-deploy-finished"><?php echo esc_html($deploy['finishedAt'] ?? $dash); ?></td></tr>
            <tr><th>上次 buildId</th><td><code id="ybb-deploy-buildid"><?php echo esc_html($deploy['lastBuildId'] ?? $dash); ?></code></td></tr>
            <tr><th>上次错误</th><td id="ybb-deploy-error"><?php echo esc_html($deploy['lastError'] ?? ''); ?></td></tr>
            <tr><th>Deploy Secret</th><td><code><?php echo esc_html($deploy['secret'] ?? ''); ?></code><p class="description">写入 secrets.local.json → deploy.runnerKey</p></td></tr>
        </table>
        <p id="ybb-deploy-live-hint" class="description" aria-live="polite">正在自动刷新部署状态…</p>
        <form method="post" action="options.php">
            <?php settings_fields('ybb_sm_group'); ?>
            <input type="hidden" name="ybb_sm_module" value="deploy" />
            <input type="hidden" name="<?php echo esc_attr(YBB_SM_OPTION); ?>[deploy][secret]" value="<?php echo esc_attr($deploy['secret'] ?? ''); ?>" />
            <?php submit_button('保存 Secret'); ?>
        </form>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:12px;">
            <?php wp_nonce_field('ybb_sm_trigger_deploy'); ?>
            <input type="hidden" name="action" value="ybb_sm_trigger_deploy" />
            <?php submit_button('立即同步站点', 'primary', 'submit', false); ?>
        </form>
        <p class="description">Runner: <code>scripts/ybb-deploy-runner.ps1 -Poll</code></p>
    </div>
    <script>
    (function () {
      var url = <?php echo wp_json_encode($statusUrl); ?>;
      var labels = { product_update: '产品更新', product_publish: '产品发布', manual: '手动触发' };
      function fmtTs(unix) {
        if (!unix) return '—';
        try { return new Date(unix * 1000).toLocaleString(); } catch (e) { return String(unix); }
      }
      function set(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      }
      function refresh() {
        fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            set('ybb-deploy-state', d.state || 'idle');
            set('ybb-deploy-pending', d.pending ? '是（等待 Runner）' : '否');
            set('ybb-deploy-trigger', labels[d.trigger] || d.trigger || '—');
            set('ybb-deploy-pending-until', fmtTs(d.pendingUntil));
            set('ybb-deploy-step', d.currentStepLabel || '—');
            set('ybb-deploy-started', d.startedAt || '—');
            set('ybb-deploy-finished', d.finishedAt || '—');
            set('ybb-deploy-buildid', d.lastBuildId || '—');
            set('ybb-deploy-error', d.lastError || '');
            var hint = '上次刷新：' + new Date().toLocaleTimeString();
            if (d.pending && !d.currentStepLabel) {
              hint += ' · 已入队，等待本机 Runner 认领（若长期不变请确认 ybb-deploy-runner.ps1 -Poll 是否在跑）';
            } else if (d.state === 'running') {
              hint += ' · 部署进行中…';
            } else if (d.state === 'success' && d.lastBuildId) {
              hint += ' · 部署成功，请 Purge 缓存后查看前台';
            }
            set('ybb-deploy-live-hint', hint);
          })
          .catch(function () {
            set('ybb-deploy-live-hint', '无法拉取部署状态（请刷新页面重试）');
          });
      }
      refresh();
      setInterval(refresh, 8000);
    })();
    </script>
    <?php
}
'''


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    pattern = re.compile(
        r"function ybb_sm_admin_tab_deploy\(array \$all\): void\n\{.*?\n\}\n?",
        re.DOTALL,
    )
    if not pattern.search(text):
        print("deploy function not found")
        return 1
    text = pattern.sub(DEPLOY_FUNC + "\n", text, count=1)
    TARGET.write_text(text, encoding="utf-8")
    print(f"patched {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
