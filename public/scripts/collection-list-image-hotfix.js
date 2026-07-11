/**
 * Hotfix: keep collection list thumbnails on Woo Featured Image (same as PDP).
 * Repairs broken card images after React hydrate / stale Woo URLs.
 */
(function () {
  var SKU_BY_HANDLE = {
    "tz-zj-002": "TZ-ZJ-002.jpeg",
    "tz-hk-001": "TZ-HK-001.jpeg",
    "tz-eldz-013": "TZ-ELDZ-013.jpeg",
    "tz-xz-014": "TZ-XZ-014.png",
    "tz-xz-004": "TZ-XZ-004.jpeg",
  };

  function candidates(handle) {
    var out = ["/products/" + handle + "/master.webp"];
    var sku = SKU_BY_HANDLE[handle];
    if (sku) {
      out.push("https://carp-ybb.com/wp-content/uploads/2026/07/" + sku);
    }
    return out;
  }

  function applySrc(img, src) {
    if (!img || img.getAttribute("src") === src) return;
    img.setAttribute("src", src);
    if (img.src !== src) img.src = src;
  }

  function tryNext(img, list, index) {
    if (index >= list.length) return;
    var src = list[index];
    var probe = new Image();
    probe.onload = function () {
      if (probe.naturalWidth > 0) applySrc(img, src);
      else tryNext(img, list, index + 1);
    };
    probe.onerror = function () {
      tryNext(img, list, index + 1);
    };
    probe.src = src;
  }

  function fixCard(link) {
    var href = link.getAttribute("href") || "";
    var handle = href.replace(/^\/products\//, "").split(/[?#]/)[0];
    if (!handle) return;
    var img = link.querySelector("img");
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) return;
    tryNext(img, candidates(handle), 0);
  }

  function run() {
    document
      .querySelectorAll('a[href^="/products/"]')
      .forEach(function (link) {
        if (!link.closest(".product-card, article")) return;
        fixCard(link);
      });
  }

  function boot() {
    run();
    window.setTimeout(run, 800);
    window.setTimeout(run, 2500);
    window.setTimeout(run, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
