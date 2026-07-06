<?php

if (!defined('ABSPATH')) {
    exit;
}

/** Search + sync toolbar �?must render OUTSIDE the settings POST form (nested forms break GET search). */
function ybb_sm_admin_tab_products_search_bar(): void
{
    $search = sanitize_text_field($_GET['product_q'] ?? '');
    $page = max(1, (int) ($_GET['product_page'] ?? 1));
    $deploy = ybb_sm_deploy_get();
    $deployState = (string) ($deploy['state'] ?? 'idle');
    $indexMeta = ybb_sm_product_index_meta();
    ?>
    <?php if ($deployState === 'running') : ?>
        <div class="notice notice-info"><p>
            <strong>静态站正在部署�?/strong>（上�?解压期间后台可能较慢）�?            顶部 buildId / 静态站列会在部署完成后更新；也可点下方「强制刷新列表」�?        </p></div>
    <?php endif; ?>
    <p>
        价格 / 库存 / SKU �?<strong>WooCommerce</strong> 为准；此处配置前台展示覆盖（标题、描�?Tab�?strong>购买�?slogan</strong>）�?        英文长描述请�?Woo 产品编辑 �?Description 填写；保存后 REST 即时生效，无需重新部署静态包�?    </p>
    <p>
        上次静态同步：
        <code><?php echo esc_html((string) ($indexMeta['lastBuiltAt'] ?? '�?)); ?></code>
        <?php if (!empty($indexMeta['lastBuildId'])) : ?>
            · buildId <code><?php echo esc_html((string) $indexMeta['lastBuildId']); ?></code>
        <?php endif; ?>
        <?php if (!empty($indexMeta['productCount'])) : ?>
            · 静态产�?<strong><?php echo (int) $indexMeta['productCount']; ?></strong>
        <?php endif; ?>
        · 部署状�?<strong><?php echo esc_html($deployState); ?></strong>
        <a class="button button-small" style="margin-left:8px;" href="<?php echo esc_url(add_query_arg([
            'page' => 'ybb-site-manager',
            'tab' => 'products',
            'product_page' => $page,
            'product_q' => $search,
            'product_refresh' => '1',
        ], admin_url('admin.php'))); ?>">强制刷新列表</a>
    </p>

    <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>" style="margin:12px 0;">
        <input type="hidden" name="page" value="ybb-site-manager" />
        <input type="hidden" name="tab" value="products" />
        <input type="search" name="product_q" value="<?php echo esc_attr($search); ?>" placeholder="SKU / handle / 标题" class="regular-text" />
        <button type="submit" class="button">搜索</button>
        <?php if ($search !== '') : ?>
            <a class="button" href="<?php echo esc_url(admin_url('admin.php?page=ybb-site-manager&tab=products')); ?>">清除</a>
        <?php endif; ?>
    </form>
    <?php
}

function ybb_sm_admin_tab_products(string $opt, array $data): void
{
    $search = sanitize_text_field($_GET['product_q'] ?? '');
    $page = max(1, (int) ($_GET['product_page'] ?? 1));
    $forceRefresh = !empty($_GET['product_refresh']);
    $catalog = ybb_sm_product_catalog_list($page, 20, $search, $forceRefresh);
    $deploy = ybb_sm_deploy_get();
    $deployState = (string) ($deploy['state'] ?? 'idle');
    $pdp = is_array($data['pdp'] ?? null) ? array_replace(ybb_sm_pdp_defaults(), $data['pdp']) : ybb_sm_pdp_defaults();
    ?>
    <p>
        <label><?php ybb_sm_admin_enabled_checkbox($opt . '[products][enabled]', !isset($data['enabled']) || !empty($data['enabled'])); ?> 启用产品覆盖 REST</label>
    </p>

    <fieldset style="margin:16px 0;padding:12px 16px;border:1px solid #c3c4c7;border-radius:4px;max-width:960px;">
        <legend><strong>全站购买�?Slogan 默认</strong></legend>
        <p class="description">PDP 右侧加购区营销段落。留空则前台使用 i18n 默认句；SKU 行内填写可覆盖�?/p>
        <p>
            <label>英文</label><br />
            <textarea rows="2" class="large-text" name="<?php echo esc_attr($opt); ?>[products][pdp][defaultSlogan][en]" placeholder="留空则用代码字典 product.defaultDescription"><?php echo esc_textarea((string) ($pdp['defaultSlogan']['en'] ?? '')); ?></textarea>
        </p>
        <p>
            <label>中文</label><br />
            <textarea rows="2" class="large-text" name="<?php echo esc_attr($opt); ?>[products][pdp][defaultSlogan][zh]"><?php echo esc_textarea((string) ($pdp['defaultSlogan']['zh'] ?? '')); ?></textarea>
        </p>
        <p>
            <label>日文</label><br />
            <textarea rows="2" class="large-text" name="<?php echo esc_attr($opt); ?>[products][pdp][defaultSlogan][ja]"><?php echo esc_textarea((string) ($pdp['defaultSlogan']['ja'] ?? '')); ?></textarea>
        </p>
        <p>
            <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][pdp][hideDefaultSloganGlobally]" value="0" />
            <label>
                <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][pdp][hideDefaultSloganGlobally]" value="1" <?php checked(!empty($pdp['hideDefaultSloganGlobally'])); ?> />
                全局隐藏 slogan（无 SKU 级自定义文案时，全站不显示该段）
            </label>
        </p>
    </fieldset>

    <style>
        .ybb-products-table-wrap { overflow-x: auto; border: 1px solid #dcdcde; border-radius: 6px; background: #fff; }
        .ybb-products-table { min-width: 2450px; table-layout: fixed; font-size: 12px; }
        .ybb-products-table th,
        .ybb-products-table td { vertical-align: top; padding: 8px 6px; line-height: 1.35; }
        .ybb-products-table th { white-space: nowrap; background: #f6f7f7; }
        .ybb-products-table .col-sku { width: 70px; }
        .ybb-products-table .col-handle { width: 90px; }
        .ybb-products-table .col-name { width: 150px; }
        .ybb-products-table .col-price { width: 56px; }
        .ybb-products-table .col-stock { width: 56px; }
        .ybb-products-table .col-wcid { width: 70px; }
        .ybb-products-table .col-status { width: 56px; }
        .ybb-products-table .col-static { width: 66px; }
        .ybb-products-table .col-short-text { width: 132px; }
        .ybb-products-table .col-textarea { width: 200px; }
        .ybb-products-table .col-flag { width: 56px; text-align: center; }
        .ybb-products-table .col-default-index { width: 70px; }
        .ybb-products-table .col-hide-indexes { width: 110px; }
        .ybb-products-table .col-actions { width: 98px; }
        .ybb-products-table input[type="text"],
        .ybb-products-table input[type="number"],
        .ybb-products-table textarea { width: 100%; max-width: 100%; font-size: 12px; }
        .ybb-products-table textarea { min-height: 48px; resize: vertical; }
        .ybb-products-table .button.button-small { margin-bottom: 4px; }
    </style>
    <div class="ybb-products-table-wrap">
    <table class="widefat striped ybb-products-table">
        <thead>
        <tr>
            <th class="col-sku">SKU</th>
            <th class="col-handle">handle</th>
            <th class="col-name">Woo 名称</th>
            <th class="col-price">�?/th>
            <th class="col-stock">库存</th>
            <th class="col-wcid">wcId</th>
            <th class="col-status">状�?/th>
            <th class="col-static">静态站</th>
            <th class="col-short-text">中文标题</th>
            <th class="col-short-text">日文标题</th>
            <th class="col-textarea">中文描述</th>
            <th class="col-textarea">日文描述</th>
            <th class="col-flag">隐藏描述</th>
            <th class="col-flag">隐藏附加</th>
            <th class="col-flag">图库启用</th>
            <th class="col-default-index">默认�?/th>
            <th class="col-flag">URL覆盖</th>
            <th class="col-textarea">覆盖图库 URL</th>
            <th class="col-textarea">Woo 当前图集</th>
            <th class="col-hide-indexes">隐藏序号</th>
            <th class="col-textarea">slogan EN</th>
            <th class="col-textarea">slogan 中文</th>
            <th class="col-textarea">slogan 日文</th>
            <th class="col-flag">隐藏 slogan</th>
            <th class="col-flag">前台隐藏</th>
            <th class="col-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <?php if (empty($catalog['items'])) : ?>
            <tr><td colspan="26">
                未找到产品。请检�?Woo 是否已上架或调整搜索词�?                <?php if (!empty($catalog['debug'])) : ?>
                    <br /><span class="description">调试�?                        source=<?php echo esc_html((string) ($catalog['debug']['source'] ?? '')); ?>,
                        deploy=<?php echo esc_html((string) ($catalog['debug']['deployState'] ?? '')); ?>,
                        reason=<?php echo esc_html((string) ($catalog['debug']['reason'] ?? '')); ?>
                        <?php if (!empty($catalog['debug']['search'])) : ?>
                            , search=<?php echo esc_html((string) $catalog['debug']['search']); ?>
                        <?php endif; ?>
                    </span>
                <?php endif; ?>
                <?php if ($deployState === 'running') : ?>
                    <br /><span class="description">静态站正在部署，Woo 查询可能暂时超时；请�?1�? 分钟后再点「强制刷新列表」�?/span>
                <?php endif; ?>
            </td></tr>
        <?php else : ?>
            <?php foreach ($catalog['items'] as $i => $row) :
                $handle = (string) ($row['handle'] ?? '');
                ?>
                <tr>
                    <td><code><?php echo esc_html((string) ($row['parentSku'] ?? '')); ?></code></td>
                    <td><code><?php echo esc_html($handle); ?></code></td>
                    <td><?php echo esc_html((string) ($row['wooName'] ?? '')); ?></td>
                    <td><?php echo esc_html(number_format((float) ($row['price'] ?? 0), 2)); ?></td>
                    <td><?php echo !empty($row['inStock']) ? '有货' : '缺货'; ?></td>
                    <td><?php echo esc_html((string) ($row['wcId'] ?? '')); ?></td>
                    <td><?php echo esc_html((string) ($row['wooStatus'] ?? '')); ?></td>
                    <td>
                        <?php if (!empty($row['staticPending'])) : ?>
                            <span class="ybb-sm-badge" style="background:#d63638;color:#fff;padding:2px 6px;border-radius:3px;">待部�?/span>
                        <?php elseif (!empty($row['staticExported'])) : ?>
                            <span class="description">已同�?/span>
                        <?php else : ?>
                            <span class="description">�?/span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][titleZh]" value="<?php echo esc_attr((string) ($row['titleZh'] ?? '')); ?>" />
                    </td>
                    <td>
                        <input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][titleJa]" value="<?php echo esc_attr((string) ($row['titleJa'] ?? '')); ?>" />
                    </td>
                    <td>
                        <textarea rows="2" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][descriptionZh]" placeholder="支持 HTML；纯文本将自动分段。留空则�?Woo 英文描述�?><?php echo esc_textarea((string) ($row['descriptionZh'] ?? '')); ?></textarea>
                    </td>
                    <td>
                        <textarea rows="2" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][descriptionJa]" placeholder="支持 HTML；纯文本将自动分段。留空则�?Woo 英文描述�?><?php echo esc_textarea((string) ($row['descriptionJa'] ?? '')); ?></textarea>
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideDescription]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideDescription]" value="1" <?php checked(!empty($row['hideDescription'])); ?> />
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideAdditionalInfo]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideAdditionalInfo]" value="1" <?php checked(!empty($row['hideAdditionalInfo'])); ?> />
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryEnabled]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryEnabled]" value="1" <?php checked(!array_key_exists('galleryEnabled', $row) || !empty($row['galleryEnabled'])); ?> />
                    </td>
                    <td>
                        <input type="number" min="0" step="1" style="width:88px;" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryDefaultIndex]" value="<?php echo esc_attr((string) ((int) ($row['galleryDefaultIndex'] ?? 0))); ?>" />
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryOverrideEnabled]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryOverrideEnabled]" value="1" <?php checked(!empty($row['galleryOverrideEnabled'])); ?> title="勾选后才使用右侧覆�?URL；未勾�?�?Woo" />
                    </td>
                    <td>
                        <textarea rows="3" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryImages]" placeholder="留空则跟 Woo 图集顺序"><?php
                            $g = $row['galleryImages'] ?? [];
                            if (is_array($g)) {
                                echo esc_textarea(implode("\n", array_map('strval', $g)));
                            } else {
                                echo esc_textarea((string) $g);
                            }
                        ?></textarea>
                        <p class="description" style="margin:4px 0 0;">
                            来源�?                            <strong><?php echo esc_html((string) ($row['gallerySource'] ?? 'woo')); ?></strong>
                        </p>
                    </td>
                    <td>
                        <textarea rows="3" class="large-text code" readonly style="background:#f6f7f7;" placeholder="Woo 主图+图集（只读基准）"><?php
                            $wooG = $row['wooGalleryImages'] ?? [];
                            if (is_array($wooG) && $wooG !== []) {
                                echo esc_textarea(implode("\n", array_map('strval', $wooG)));
                            }
                        ?></textarea>
                    </td>
                    <td>
                        <input type="text" class="regular-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][galleryHideIndexes]" value="<?php
                            $h = $row['galleryHideIndexes'] ?? [];
                            if (is_array($h)) {
                                echo esc_attr(implode(',', array_map('intval', $h)));
                            } else {
                                echo esc_attr((string) $h);
                            }
                        ?>" placeholder="�? 2,3" />
                    </td>
                    <td>
                        <textarea rows="2" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][sloganEn]" placeholder="留空则用全站默认"><?php echo esc_textarea((string) ($row['sloganEn'] ?? '')); ?></textarea>
                    </td>
                    <td>
                        <textarea rows="2" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][sloganZh]" placeholder="留空则用全站默认"><?php echo esc_textarea((string) ($row['sloganZh'] ?? '')); ?></textarea>
                    </td>
                    <td>
                        <textarea rows="2" class="large-text code" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][sloganJa]" placeholder="留空则用全站默认"><?php echo esc_textarea((string) ($row['sloganJa'] ?? '')); ?></textarea>
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideSlogan]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][hideSlogan]" value="1" <?php checked(!empty($row['hideSlogan'])); ?> />
                    </td>
                    <td>
                        <input type="hidden" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][frontHidden]" value="0" />
                        <input type="checkbox" name="<?php echo esc_attr($opt); ?>[products][overrides][<?php echo esc_attr($handle); ?>][frontHidden]" value="1" <?php checked(!empty($row['frontHidden'])); ?> />
                    </td>
                    <td>
                        <a class="button button-small" href="<?php echo esc_url((string) ($row['editUrl'] ?? '#')); ?>" target="_blank" rel="noopener">Woo</a>
                        <a class="button button-small" href="<?php echo esc_url((string) ($row['pdpUrl'] ?? '#')); ?>" target="_blank" rel="noopener">前台</a>
                    </td>
                </tr>
            <?php endforeach; ?>
        <?php endif; ?>
        </tbody>
    </table>
    </div>

    <?php
    $total = (int) ($catalog['total'] ?? 0);
    $perPage = (int) ($catalog['perPage'] ?? 20);
    $pages = $perPage > 0 ? (int) ceil($total / $perPage) : 1;
    if ($pages > 1) :
        ?>
        <p class="tablenav">
            <?php for ($p = 1; $p <= min($pages, 20); $p++) :
                $url = add_query_arg([
                    'page' => 'ybb-site-manager',
                    'tab' => 'products',
                    'product_page' => $p,
                    'product_q' => $search,
                ], admin_url('admin.php'));
                ?>
                <a class="button <?php echo $p === $page ? 'button-primary' : ''; ?>" href="<?php echo esc_url($url); ?>"><?php echo (int) $p; ?></a>
            <?php endfor; ?>
            <span class="description">�?<?php echo (int) $total; ?> 个父商品</span>
        </p>
    <?php endif; ?>

    <p class="description" style="margin-top:16px;">
        上新 / 改变�?/ �?SKU 后请�?<a href="<?php echo esc_url(admin_url('admin.php?page=ybb-site-manager&tab=deploy')); ?>">部署状�?/a> 触发静态同步�?    </p>
    <?php
}
