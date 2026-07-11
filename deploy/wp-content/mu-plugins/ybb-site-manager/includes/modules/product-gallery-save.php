<?php

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', static function (string $hook): void {
    if ($hook !== 'post.php' && $hook !== 'post-new.php') {
        return;
    }
    if (!function_exists('get_current_screen')) {
        return;
    }

    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'product') {
        return;
    }

    wp_register_script('ybb-sm-product-gallery-save', false, ['jquery'], YBB_SM_VERSION, true);
    wp_enqueue_script('ybb-sm-product-gallery-save');
    wp_add_inline_script('ybb-sm-product-gallery-save', <<<'JS'
(function ($) {
  function statusText($el, text, kind) {
    $el.removeClass('is-error is-success is-working');
    if (kind) $el.addClass('is-' + kind);
    $el.text(text || '');
  }

  function parseIds(raw) {
    return String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async function saveGallery($button, $status) {
    const postId = Number($('#post_ID').val() || 0);
    const featuredId = Number($('#_thumbnail_id').val() || 0);
    const galleryIds = parseIds($('input[name="product_image_gallery"]').val());
    const nonce = window.wpApiSettings && window.wpApiSettings.nonce;

    if (!postId || !nonce) {
      statusText($status, '缺少 postId 或 REST nonce，无法保存图集。', 'error');
      return;
    }

    const imageIds = [];
    if (featuredId > 0) imageIds.push(featuredId);
    galleryIds.forEach((id) => {
      if (!imageIds.includes(id)) imageIds.push(id);
    });

    statusText($status, '正在保存图集到 Woo...', 'working');
    $button.prop('disabled', true);

    try {
      const resp = await fetch('/wp-json/wc/v3/products/' + postId, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify({
          images: imageIds.map((id) => ({ id })),
        }),
      });

      const text = await resp.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = null;
      }

      if (!resp.ok) {
        const msg = data && data.message ? data.message : ('HTTP ' + resp.status);
        throw new Error(msg);
      }

      const saved = Array.isArray(data && data.images) ? data.images.length : imageIds.length;
      statusText($status, '图集已保存到 Woo（' + saved + ' 张）。可直接刷新前台验证。', 'success');
    } catch (err) {
      statusText($status, '保存失败：' + (err && err.message ? err.message : err), 'error');
    } finally {
      $button.prop('disabled', false);
    }
  }

  $(function () {
    const $box = $('#woocommerce-product-images');
    if (!$box.length || $box.find('.ybb-gallery-save-wrap').length) {
      return;
    }

    const $wrap = $('<div class="ybb-gallery-save-wrap" />');
    const $button = $('<button type="button" class="button button-primary ybb-gallery-save-btn">保存图集到 Woo</button>');
    const $status = $('<p class="description ybb-gallery-save-status" />');

    $button.on('click', function () {
      saveGallery($button, $status);
    });

    $wrap.append($button).append($status);
    $box.find('.inside').append($wrap);
  });
})(jQuery);
JS
    );

    wp_add_inline_style(
        'wp-admin',
        '.ybb-gallery-save-wrap{margin-top:12px;padding-top:8px;border-top:1px solid #dcdcde;}'
        . '.ybb-gallery-save-status{margin:8px 0 0;}'
        . '.ybb-gallery-save-status.is-success{color:#008a20;}'
        . '.ybb-gallery-save-status.is-error{color:#b32d2e;}'
        . '.ybb-gallery-save-status.is-working{color:#3858e9;}'
    );
});

