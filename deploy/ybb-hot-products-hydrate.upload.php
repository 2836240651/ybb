<?php
/**
 * Plugin Name: YBB Hot Products Hydrate
 * Description: Runtime hydrate for static homepage Hot Products carousel (browser-configured).
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/hot-products-hydrate.js', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_hot_products_hydrate_js',
    ]);
});

function ybb_hot_products_hydrate_js(): void
{
    $api = esc_url_raw(rest_url('ybb/v1/hot-products'));
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo '(function () {' . "\n";
    echo '  var API = ' . wp_json_encode($api) . ";\n";
    echo <<<'JS'
  var SLIDE_CLASS = 'min-w-0 shrink-0 grow-0 basis-[min(80vw,280px)] sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4.5rem)/4)]';

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return '';
    return '£' + n.toFixed(2);
  }

  function productCardHtml(product) {
    var img = product.image || '';
    if (img && img.indexOf('http') !== 0 && img.indexOf('/') !== 0) img = '/' + img;
    var href = product.href || ('/products/' + product.handle);
    var title = product.title || product.handle;
    var price = formatPrice(product.price);
    var compare = product.compareAtPrice ? formatPrice(product.compareAtPrice) : '';
    var priceHtml = compare
      ? '<span class="text-sm font-medium text-sale">' + price + '</span><span class="text-sm text-neutral-400 line-through">' + compare + '</span>'
      : (price ? '<span class="text-sm font-medium">' + price + '</span>' : '');
    return (
      '<div class="' + SLIDE_CLASS + ' ybb-hot-slide" data-handle="' + product.handle + '">' +
        '<article class="product-card group relative flex flex-col bg-white">' +
          '<div class="relative overflow-hidden rounded-card bg-neutral-50 aspect-square">' +
            '<a href="' + href + '" class="absolute inset-0 z-0 block" aria-label="' + title.replace(/"/g, '&quot;') + '">' +
              '<img src="' + img + '" alt="' + title.replace(/"/g, '&quot;') + '" class="h-full w-full object-cover" loading="lazy" />' +
            '</a>' +
          '</div>' +
          '<div class="mt-3 flex flex-col gap-1">' +
            '<h3 class="text-sm font-medium leading-snug"><a href="' + href + '" class="hover:underline">' + title + '</a></h3>' +
            (priceHtml ? '<div class="flex items-center gap-2">' + priceHtml + '</div>' : '') +
          '</div>' +
        '</article>' +
      '</div>'
    );
  }

  function findAnchor() {
    return document.querySelector('[aria-labelledby="categories-heading"]')
      || document.querySelector('[aria-labelledby="featured-product-heading"]')
      || document.querySelector('.home-sections');
  }

  function ensureSection() {
    var existing = document.getElementById('ybb-hot-products-section');
    if (existing) return existing;
    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return null;
    var section = document.createElement('section');
    section.id = 'ybb-hot-products-section';
    section.className = 'page-container';
    section.setAttribute('aria-labelledby', 'hot-products-heading');
    section.innerHTML =
      '<div class="mb-8 flex items-center justify-between gap-4">' +
        '<h2 id="hot-products-heading" class="text-title-md">Hot Products</h2>' +
      '</div>' +
      '<div class="overflow-hidden ybb-hot-viewport" role="region" aria-roledescription="carousel" aria-label="Hot products carousel">' +
        '<div class="flex touch-pan-y gap-4 md:gap-6 ybb-hot-track will-change-transform"></div>' +
      '</div>';
    if (anchor.nextSibling) {
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
    } else {
      anchor.parentNode.appendChild(section);
    }
    return section;
  }

  function startAutoplay(viewport, track, delay) {
    if (viewport.__ybbHotTimer) clearInterval(viewport.__ybbHotTimer);
    var slides = track.children;
    if (!slides || slides.length < 2) return;
    var index = 0;
    viewport.__ybbHotTimer = setInterval(function () {
      index = (index + 1) % slides.length;
      var slide = slides[index];
      if (!slide) return;
      track.style.transition = 'transform 0.55s ease';
      track.style.transform = 'translate3d(-' + slide.offsetLeft + 'px,0,0)';
    }, delay || 4000);
    viewport.addEventListener('mouseenter', function () {
      if (viewport.__ybbHotTimer) clearInterval(viewport.__ybbHotTimer);
    });
    viewport.addEventListener('mouseleave', function () {
      startAutoplay(viewport, track, delay);
    });
  }

  function renderProducts(section, products, autoplayMs) {
    var track = section.querySelector('.ybb-hot-track');
    var viewport = section.querySelector('.ybb-hot-viewport');
    if (!track || !viewport) return;
    track.innerHTML = products.map(productCardHtml).join('');
    track.style.transform = 'translate3d(0,0,0)';
    track.__ybbHotProducts = products;
    startAutoplay(viewport, track, autoplayMs);
    if (!track.__ybbHotObserver) {
      track.__ybbHotObserver = new MutationObserver(function () {
        if (track.__ybbHotEnforcing || !track.__ybbHotProducts) return;
        track.__ybbHotEnforcing = true;
        renderProducts(section, track.__ybbHotProducts, autoplayMs);
        track.__ybbHotEnforcing = false;
      });
      track.__ybbHotObserver.observe(track, { childList: true });
    }
    window.dispatchEvent(new Event('resize'));
  }

  function syncExistingSection(section, products, autoplayMs) {
    var track = section.querySelector('.flex.touch-pan-y');
    if (!track) {
      renderProducts(section, products, autoplayMs);
      return;
    }
    var templateSlide = track.querySelector('[class*="basis-"]') || track.firstElementChild;
    products.forEach(function (product, index) {
      var slide = track.children[index];
      if (!slide && templateSlide) {
        slide = templateSlide.cloneNode(true);
        track.appendChild(slide);
      }
      if (!slide) return;
      slide.setAttribute('data-handle', product.handle);
      var link = slide.querySelector('a[href]');
      if (link && product.href) link.href = product.href;
      var img = slide.querySelector('img');
      if (img && product.image) {
        img.src = product.image + (product.image.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
        img.alt = product.title || img.alt || '';
      }
      var title = slide.querySelector('h3');
      if (title && product.title) title.textContent = product.title;
    });
    for (var i = products.length; i < track.children.length; i++) {
      var extra = track.children[i];
      if (extra && extra.parentNode) extra.parentNode.removeChild(extra);
    }
    track.__ybbHotProducts = products;
    var viewport = section.querySelector('.overflow-hidden') || section;
    startAutoplay(viewport, track, autoplayMs);
  }

  function hydrate() {
    fetch(API + (API.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var section = document.querySelector('[aria-labelledby="hot-products-heading"]')
          || document.getElementById('ybb-hot-products-section');
        if (!data || !data.enabled || !data.products || !data.products.length) {
          if (section && section.id === 'ybb-hot-products-section') section.remove();
          return;
        }
        if (!section) section = ensureSection();
        if (!section) return;
        if (section.id === 'ybb-hot-products-section') {
          renderProducts(section, data.products, data.autoplayMs || 4000);
        } else {
          syncExistingSection(section, data.products, data.autoplayMs || 4000);
        }
      })
      .catch(function () {});
  }

  function scheduleHydrate() {
    hydrate();
    setTimeout(hydrate, 600);
    setTimeout(hydrate, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHydrate);
  } else {
    scheduleHydrate();
  }
  window.addEventListener('load', scheduleHydrate);
})();
JS;
    exit;
}
