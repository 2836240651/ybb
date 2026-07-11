<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once YBB_SM_DIR . '/includes/admin/tab-audit.php';

function ybb_sm_admin_enabled_checkbox(string $name, bool $checked): void
{
    printf(
        '<input type="hidden" name="%1$s" value="0" /><input type="checkbox" name="%1$s" value="1" %2$s />',
        esc_attr($name),
        checked($checked, true, false)
    );
}

function ybb_sm_render_admin_page(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $tab = sanitize_key($_GET['tab'] ?? 'navigation');
    $allowed = apply_filters('ybb_sm_admin_allowed_tabs', [
        'navigation', 'announcements', 'hero', 'home', 'blog', 'products', 'video', 'featured', 'brand', 'contact', 'deploy', 'audit',
    ]);
    if (!in_array($tab, $allowed, true)) {
        $tab = 'navigation';
    }

    $opt = YBB_SM_OPTION;
    $all = ybb_sm_get_all();
    ?>
    <div class="wrap ybb-sm-admin">
        <h1>YBB 站点管理</h1>
        <?php if (!empty($_GET['settings-updated'])) : ?>
            <div class="notice notice-success is-dismissible"><p>设置已保存。<?php if ($tab === 'blog') : ?>已有文章请<strong>硬刷新</strong>前台页面查看（无需重新部署静态包）。<?php endif; ?></p></div>
        <?php endif; ?>
        <?php if (!empty($_GET['reset'])) : ?>
            <div class="notice notice-success is-dismissible"><p>已恢复默认。</p></div>
        <?php endif; ?>
        <?php if (!empty($_GET['queued'])) : ?>
            <div class="notice notice-success is-dismissible"><p>部署任务已入队。</p></div>
        <?php endif; ?>

        <nav class="nav-tab-wrapper">
            <?php
            $labels = [
                'navigation' => '导航',
                'announcements' => '公告',
                'hero' => 'Hero',
                'home' => '首页模块',
                'blog' => '博客',
                'products' => '产品',
                'video' => '视频',
                'featured' => 'Featured',
                'brand' => '品牌',
                'contact' => '联系',
                'deploy' => '部署状态',
                'audit' => '操作记录',
            ];
            $labels = apply_filters('ybb_sm_admin_tab_labels', $labels);
            foreach ($labels as $key => $label) :
                $url = add_query_arg(['page' => 'ybb-site-manager', 'tab' => $key], admin_url('admin.php'));
                ?>
                <a href="<?php echo esc_url($url); ?>" class="nav-tab <?php echo $tab === $key ? 'nav-tab-active' : ''; ?>"><?php echo esc_html($label); ?></a>
            <?php endforeach; ?>
        </nav>

        <?php if ($tab === 'deploy') : ?>
            <?php ybb_sm_admin_tab_deploy($all); ?>
        <?php elseif ($tab === 'audit') : ?>
            <?php ybb_sm_admin_tab_audit(); ?>
        <?php elseif (has_action('ybb_sm_admin_render_tab_' . $tab)) : ?>
            <?php do_action('ybb_sm_admin_render_tab_' . $tab); ?>
        <?php else : ?>
            <?php if ($tab === 'products') {
                ybb_sm_admin_tab_products_search_bar();
            } ?>
            <?php if ($tab === 'blog' && sanitize_title((string) ($_GET['article'] ?? '')) === '') {
                ybb_sm_admin_tab_blog_toolbar();
            } ?>
            <form method="post" action="options.php" style="margin-top:16px;">
                <?php settings_fields('ybb_sm_group'); ?>
                <input type="hidden" name="ybb_sm_module" value="<?php echo esc_attr($tab); ?>" />
                <?php
                switch ($tab) {
                    case 'navigation':
                        ybb_sm_admin_tab_navigation($opt, $all['navigation'] ?? []);
                        break;
                    case 'announcements':
                        ybb_sm_admin_tab_announcements($opt, $all['announcements'] ?? []);
                        break;
                    case 'hero':
                        ybb_sm_admin_tab_hero($opt, $all['hero'] ?? []);
                        break;
                    case 'home':
                        ybb_sm_admin_tab_home($opt, ybb_sm_home_get_settings());
                        break;
                    case 'blog':
                        ybb_sm_admin_tab_blog_router($opt, $all['blog'] ?? ybb_sm_blog_defaults());
                        break;
                    case 'products':
                        ybb_sm_admin_tab_products($opt, $all['products'] ?? ybb_sm_products_defaults());
                        break;
                    case 'video':
                        ybb_sm_admin_tab_video($opt, $all['video'] ?? []);
                        break;
                    case 'featured':
                        ybb_sm_admin_tab_featured($opt, $all['featured'] ?? []);
                        break;
                    case 'brand':
                        ybb_sm_admin_tab_brand($opt, ybb_sm_brand_get());
                        break;
                    case 'contact':
                        ybb_sm_admin_tab_contact($opt, ybb_sm_contact_public());
                        break;
                }
                submit_button($tab === 'blog' && sanitize_title((string) ($_GET['article'] ?? '')) !== '' ? '保存本文' : '保存');
                ?>
            </form>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:12px;">
                <?php wp_nonce_field('ybb_sm_reset_module'); ?>
                <input type="hidden" name="action" value="ybb_sm_reset_module" />
                <input type="hidden" name="module" value="<?php echo esc_attr($tab); ?>" />
                <?php submit_button('恢复本 Tab 默认', 'secondary', 'submit', false, ['onclick' => "return confirm('确定恢复默认？');"]); ?>
            </form>
        <?php endif; ?>

        <p style="margin-top:24px;color:#666;">
            <?php if ($tab !== 'audit' && $tab !== 'deploy' && $tab !== 'reviews-import') : ?>
            REST 示例：<code><?php echo esc_html(rest_url('ybb/v1/site-manager/' . ($tab === 'home' ? 'hot-products' : $tab))); ?></code>
            <?php endif; ?>
        </p>
        <p style="color:#666;font-size:12px;">
            旧菜单 YBB Home Settings / YBB Site Brand 仍可用；数据已同步至本插件。Hot Products / Latest Stories 请在本页「首页模块」Tab 编辑。        </p>
    </div>
    <?php
}

function ybb_sm_admin_reset_form(string $module): void
{
    ?>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
        <?php wp_nonce_field('ybb_sm_reset_module'); ?>
        <input type="hidden" name="action" value="ybb_sm_reset_module" />
        <input type="hidden" name="module" value="<?php echo esc_attr($module); ?>" />
    </form>
    <?php
}

function ybb_sm_admin_tab_navigation(string $opt, array $nav): void
{
    $primary = $nav['primaryNav'] ?? [];
    $emptyWarnings = function_exists('ybb_sm_navigation_empty_collection_warnings')
        ? ybb_sm_navigation_empty_collection_warnings($nav)
        : [];
    ?>
    <h2>顶部导航</h2>
    <?php if ($emptyWarnings !== []) : ?>
        <div class="notice notice-warning inline" style="margin:12px 0;padding:12px;">
            <p><strong>空类目提醒：</strong>以下导航链接指向的类目在 Woo �?<strong>0 个已发布（publish）商品</strong>，访客将进入空列表页。</p>
            <ul style="margin:8px 0 0 1.2em;list-style:disc;">
                <?php foreach ($emptyWarnings as $warning) : ?>
                    <li>
                        <code><?php echo esc_html($warning['handle']); ?></code>
                        �?<?php echo esc_html($warning['label']); ?>
                        (<a href="<?php echo esc_url(home_url($warning['href'])); ?>" target="_blank" rel="noopener"><?php echo esc_html($warning['href']); ?></a>)
                    </li>
                <?php endforeach; ?>
            </ul>
            <p class="description" style="margin-top:8px;">建议：取消勾选对应导航项，或先在 Woo 上架商品后执行静态站重建（<code>run-catalog-rebuild.ps1</code>）。</p>
        </div>
    <?php endif; ?>
    <table class="widefat striped ybb-sm-repeater">
        <thead><tr><th>显示</th><th>英文 label</th><th>链接</th><th>中文</th><th>日文</th></tr></thead>
        <tbody>
        <?php foreach ($primary as $i => $item) : ?>
            <tr>
                <td><?php ybb_sm_admin_enabled_checkbox($opt . '[navigation][primaryNav][' . $i . '][enabled]', !isset($item['enabled']) || !empty($item['enabled'])); ?></td>
                <td>
                    <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][id]" value="<?php echo esc_attr($item['id'] ?? ''); ?>" />
                    <input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][label]" value="<?php echo esc_attr($item['label'] ?? ''); ?>" />
                </td>
                <td><input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][href]" value="<?php echo esc_attr($item['href'] ?? ''); ?>" /></td>
                <td><input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][labels][zh]" value="<?php echo esc_attr($item['labels']['zh'] ?? ''); ?>" /></td>
                <td><input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][labels][ja]" value="<?php echo esc_attr($item['labels']['ja'] ?? ''); ?>" /></td>
            </tr>
            <?php if (!empty($item['megaMenu'])) :
                $mega = $item['megaMenu'];
                foreach ($mega['children'] ?? [] as $ci => $child) : ?>
                <tr style="background:#f9f9f9;">
                    <td></td>
                    <td colspan="2">
                        �?<input type="text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][children][<?php echo $ci; ?>][label]" value="<?php echo esc_attr($child['label'] ?? ''); ?>" />
                        <input type="text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][children][<?php echo $ci; ?>][href]" value="<?php echo esc_attr($child['href'] ?? ''); ?>" placeholder="href" />
                    </td>
                    <td><input type="text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][children][<?php echo $ci; ?>][labels][zh]" value="<?php echo esc_attr($child['labels']['zh'] ?? ''); ?>" /></td>
                    <td><input type="text" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][children][<?php echo $ci; ?>][labels][ja]" value="<?php echo esc_attr($child['labels']['ja'] ?? ''); ?>" /></td>
                </tr>
                <?php endforeach; ?>
                <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][variant]" value="<?php echo esc_attr($mega['variant'] ?? 'category'); ?>" />
                <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][shopAll][label]" value="<?php echo esc_attr($mega['shopAll']['label'] ?? ''); ?>" />
                <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][shopAll][href]" value="<?php echo esc_attr($mega['shopAll']['href'] ?? ''); ?>" />
                <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][shopAll][labels][zh]" value="<?php echo esc_attr($mega['shopAll']['labels']['zh'] ?? ''); ?>" />
                <input type="hidden" name="<?php echo esc_attr($opt); ?>[navigation][primaryNav][<?php echo $i; ?>][megaMenu][shopAll][labels][ja]" value="<?php echo esc_attr($mega['shopAll']['labels']['ja'] ?? ''); ?>" />
            <?php endif; ?>
        <?php endforeach; ?>
        </tbody>
    </table>
    <p class="description">保存后前台 Header / 移动导航立即更新，无需重新部署静态站。</p>
    <?php
}

function ybb_sm_admin_tab_announcements(string $opt, array $data): void
{
    ?>
    <p><label><?php ybb_sm_admin_enabled_checkbox($opt . '[announcements][enabled]', !empty($data['enabled'])); ?> 显示公告栏</label></p>
    <table class="widefat striped">
        <thead><tr><th>显示</th><th>ID</th><th>English</th><th>中文</th><th>日文</th><th>链接</th></tr></thead>
        <tbody>
        <?php foreach ($data['items'] ?? [] as $i => $item) : ?>
            <tr>
                <td><?php ybb_sm_admin_enabled_checkbox($opt . '[announcements][items][' . $i . '][enabled]', !isset($item['enabled']) || !empty($item['enabled'])); ?></td>
                <td><input type="text" name="<?php echo esc_attr($opt); ?>[announcements][items][<?php echo $i; ?>][id]" value="<?php echo esc_attr($item['id'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[announcements][items][<?php echo $i; ?>][labels][en]" value="<?php echo esc_attr($item['labels']['en'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[announcements][items][<?php echo $i; ?>][labels][zh]" value="<?php echo esc_attr($item['labels']['zh'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[announcements][items][<?php echo $i; ?>][labels][ja]" value="<?php echo esc_attr($item['labels']['ja'] ?? ''); ?>" /></td>
                <td><input type="text" name="<?php echo esc_attr($opt); ?>[announcements][items][<?php echo $i; ?>][href]" value="<?php echo esc_attr($item['href'] ?? ''); ?>" /></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
}

function ybb_sm_admin_tab_hero(string $opt, array $data): void
{
    ?>
    <p><label><?php ybb_sm_admin_enabled_checkbox($opt . '[hero][enabled]', !empty($data['enabled'])); ?> 显示 Hero 轮播</label></p>
    <p>自动播放间隔（ms）：<input type="number" min="3000" max="20000" name="<?php echo esc_attr($opt); ?>[hero][autoplayMs]" value="<?php echo esc_attr((string) ($data['autoplayMs'] ?? 7000)); ?>" /></p>
    <table class="widefat striped">
        <thead><tr><th>显示</th><th>ID</th><th>图片 URL</th><th>链接</th><th>English 标题</th><th>中文</th><th>日文</th></tr></thead>
        <tbody>
        <?php foreach ($data['slides'] ?? [] as $i => $slide) : ?>
            <tr>
                <td><?php ybb_sm_admin_enabled_checkbox($opt . '[hero][slides][' . $i . '][enabled]', !isset($slide['enabled']) || !empty($slide['enabled'])); ?></td>
                <td><input type="text" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][id]" value="<?php echo esc_attr($slide['id'] ?? ''); ?>" /></td>
                <td>
                    <input type="text" class="large-text ybb-sm-image" id="hero-img-<?php echo $i; ?>" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][imageUrl]" value="<?php echo esc_attr($slide['imageUrl'] ?? ''); ?>" />
                    <button type="button" class="button ybb-sm-pick-image" data-target="#hero-img-<?php echo $i; ?>">选图</button>
                </td>
                <td><input type="text" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][href]" value="<?php echo esc_attr($slide['href'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][labels][en]" value="<?php echo esc_attr($slide['labels']['en'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][labels][zh]" value="<?php echo esc_attr($slide['labels']['zh'] ?? ''); ?>" /></td>
                <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[hero][slides][<?php echo $i; ?>][labels][ja]" value="<?php echo esc_attr($slide['labels']['ja'] ?? ''); ?>" /></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
}

function ybb_sm_admin_tab_home(string $opt, array $settings): void
{
    $hotProducts = $settings['hotProducts'] ?? [];
    ?>
    <p>以下三个开关为首页区块<strong>总开关</strong>，保存后前台 REST 立即生效，无需重传静态包。Hot Products 列表在下方配置；最近更新（Latest Stories）正文在 <strong>博客</strong> Tab 勾选「Homepage」。</p></td></tr>
        <tr><th>Hot Products</th><td><label><?php ybb_sm_admin_enabled_checkbox($opt . '[home][hotProductsEnabled]', !empty($settings['hotProductsEnabled'])); ?> 显示</label>
            间隔 ms: <input type="number" name="<?php echo esc_attr($opt); ?>[home][hotProductsAutoplayMs]" value="<?php echo esc_attr((string) ($settings['hotProductsAutoplayMs'] ?? 4000)); ?>" style="width:90px;" /></td></tr>
    </table>
    <h3>Hot Products</h3>
    <table class="widefat striped"><thead><tr><th>显示</th><th>Slug</th><th>标题覆盖</th></tr></thead><tbody>
    <?php foreach ($hotProducts as $i => $row) : ?>
        <tr>
            <td><?php ybb_sm_admin_enabled_checkbox($opt . '[home][hotProducts][' . $i . '][enabled]', !empty($row['enabled'])); ?></td>
            <td><input type="hidden" name="<?php echo esc_attr($opt); ?>[home][hotProducts][<?php echo $i; ?>][id]" value="<?php echo esc_attr($row['id'] ?? ''); ?>" />
                <input type="text" name="<?php echo esc_attr($opt); ?>[home][hotProducts][<?php echo $i; ?>][handle]" value="<?php echo esc_attr($row['handle'] ?? ''); ?>" /></td>
            <td><input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[home][hotProducts][<?php echo $i; ?>][titleOverride]" value="<?php echo esc_attr($row['titleOverride'] ?? ''); ?>" /></td>
        </tr>
    <?php endforeach; ?>
    </tbody></table>
    <?php
}

function ybb_sm_admin_tab_video(string $opt, array $data): void
{
    $labels = $data['labels'] ?? [];
    ?>
    <p><label><?php ybb_sm_admin_enabled_checkbox($opt . '[video][enabled]', !empty($data['enabled'])); ?> 显示视频模块</label></p>
    <table class="form-table">
        <tr><th>视频 URL</th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[video][videoUrl]" value="<?php echo esc_attr($data['videoUrl'] ?? ''); ?>" placeholder="/videos/factory-showcase.mp4" /></td></tr>
        <tr><th>封面 URL</th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[video][posterUrl]" value="<?php echo esc_attr($data['posterUrl'] ?? ''); ?>" /></td></tr>
        <?php foreach (['title' => '标题', 'body' => '正文', 'cta' => '按钮'] as $key => $label) : ?>
            <tr><th><?php echo esc_html($label); ?> (EN/ZH/JA)</th><td>
                <input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[video][labels][<?php echo esc_attr($key); ?>][en]" value="<?php echo esc_attr($labels[$key]['en'] ?? ''); ?>" placeholder="English" /><br />
                <input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[video][labels][<?php echo esc_attr($key); ?>][zh]" value="<?php echo esc_attr($labels[$key]['zh'] ?? ''); ?>" placeholder="中文" style="margin-top:4px;" /><br />
                <input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[video][labels][<?php echo esc_attr($key); ?>][ja]" value="<?php echo esc_attr($labels[$key]['ja'] ?? ''); ?>" placeholder="日本�? style="margin-top:4px;" />
            </td></tr>
        <?php endforeach; ?>
    </table>
    <?php
}

function ybb_sm_admin_tab_featured(string $opt, array $data): void
{
    ?>
    <p><label><?php ybb_sm_admin_enabled_checkbox($opt . '[featured][enabled]', !empty($data['enabled'])); ?> 显示 Featured 主推</label></p>
    <p>产品 slug�?input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[featured][handle]" value="<?php echo esc_attr($data['handle'] ?? ''); ?>" placeholder="three-way-swivel-kit-box" /></p>
    <?php
}

function ybb_sm_admin_tab_brand(string $opt, array $brand): void
{
    ?>
    <table class="form-table">
        <tr><th>主标�?/th><td><input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[brand][name]" value="<?php echo esc_attr($brand['name'] ?? ''); ?>" /></td></tr>
        <tr><th>副标�?EN</th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[brand][tagline][en]" value="<?php echo esc_attr($brand['tagline']['en'] ?? ''); ?>" /></td></tr>
        <tr><th>副标�?中文</th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[brand][tagline][zh]" value="<?php echo esc_attr($brand['tagline']['zh'] ?? ''); ?>" /></td></tr>
        <tr><th>副标�?日本�?/th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[brand][tagline][ja]" value="<?php echo esc_attr($brand['tagline']['ja'] ?? ''); ?>" /></td></tr>
        <tr><th>Logo 路径</th><td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[brand][logoPath]" value="<?php echo esc_attr($brand['logoPath'] ?? '/images/brand/ybb-logo.png'); ?>" /></td></tr>
    </table>
    <p class="description">品牌文案前台 client fetch 读取，无需 sync 静态包�?/p>
    <?php
}

function ybb_sm_admin_tab_contact(string $opt, array $contact): void
{
    ?>
    <h2>Contact / 联系我们</h2>
    <p class="description">保存后前�?<code>/contact</code> �?<code>/pages/contact</code> 通过 REST 即时读取，无需重新部署静态包。表单邮件收件箱与下方「销售邮箱」同步�?/p>
    <table class="form-table">
        <tr>
            <th scope="row"><label for="ybb_sm_contact_sales_email">销售邮�?/label></th>
            <td>
                <input type="email" class="regular-text" id="ybb_sm_contact_sales_email"
                       name="<?php echo esc_attr($opt); ?>[contact][salesEmail]"
                       value="<?php echo esc_attr($contact['salesEmail'] ?? 'ybb.sales@yoto.work'); ?>" />
            </td>
        </tr>
        <tr>
            <th scope="row"><label for="ybb_sm_contact_phone">电话</label></th>
            <td>
                <input type="text" class="regular-text" id="ybb_sm_contact_phone"
                       name="<?php echo esc_attr($opt); ?>[contact][phoneNumber]"
                       value="<?php echo esc_attr($contact['phoneNumber'] ?? ''); ?>" />
            </td>
        </tr>
        <tr>
            <th scope="row"><label for="ybb_sm_contact_company_en">公司名（英文�?/label></th>
            <td>
                <input type="text" class="large-text" id="ybb_sm_contact_company_en"
                       name="<?php echo esc_attr($opt); ?>[contact][companyLegalName]"
                       value="<?php echo esc_attr($contact['companyLegalName'] ?? ''); ?>" />
            </td>
        </tr>
        <tr>
            <th scope="row"><label for="ybb_sm_contact_company_zh">公司名（中文�?/label></th>
            <td>
                <input type="text" class="large-text" id="ybb_sm_contact_company_zh"
                       name="<?php echo esc_attr($opt); ?>[contact][companyLegalNameZh]"
                       value="<?php echo esc_attr($contact['companyLegalNameZh'] ?? ''); ?>" />
            </td>
        </tr>
        <tr>
            <th scope="row">导语 EN</th>
            <td>
                <textarea class="large-text" rows="3"
                          name="<?php echo esc_attr($opt); ?>[contact][intro][en]"><?php echo esc_textarea($contact['intro']['en'] ?? ''); ?></textarea>
            </td>
        </tr>
        <tr>
            <th scope="row">导语 中文</th>
            <td>
                <textarea class="large-text" rows="3"
                          name="<?php echo esc_attr($opt); ?>[contact][intro][zh]"><?php echo esc_textarea($contact['intro']['zh'] ?? ''); ?></textarea>
            </td>
        </tr>
        <tr>
            <th scope="row">导语 日本�?/th>
            <td>
                <textarea class="large-text" rows="3"
                          name="<?php echo esc_attr($opt); ?>[contact][intro][ja]"><?php echo esc_textarea($contact['intro']['ja'] ?? ''); ?></textarea>
            </td>
        </tr>
        <tr>
            <th scope="row">工作时间 EN</th>
            <td>
                <textarea class="large-text" rows="2"
                          name="<?php echo esc_attr($opt); ?>[contact][hoursDetail][en]"><?php echo esc_textarea($contact['hoursDetail']['en'] ?? ''); ?></textarea>
            </td>
        </tr>
        <tr>
            <th scope="row">工作时间 中文</th>
            <td>
                <textarea class="large-text" rows="2"
                          name="<?php echo esc_attr($opt); ?>[contact][hoursDetail][zh]"><?php echo esc_textarea($contact['hoursDetail']['zh'] ?? ''); ?></textarea>
            </td>
        </tr>
        <tr>
            <th scope="row">工作时间 日本�?/th>
            <td>
                <textarea class="large-text" rows="2"
                          name="<?php echo esc_attr($opt); ?>[contact][hoursDetail][ja]"><?php echo esc_textarea($contact['hoursDetail']['ja'] ?? ''); ?></textarea>
            </td>
        </tr>
    </table>
    <?php
}

function ybb_sm_admin_tab_deploy(array $all): void
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

