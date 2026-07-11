/**
 * Collection list: align card thumbnails with PDP main image (Woo Featured Image).
 * Static export may bake stale/broken image URLs; PDP uses product-live API.
 */
(function () {
  const MASTER = (handle) => `/products/${handle}/master.webp`;

  function handleFromCard(card) {
    const link = card.querySelector('a[href*="/products/"]');
    if (!link) return null;
    const m = link.getAttribute("href")?.match(/\/products\/([^/?#]+)/);
    return m?.[1] ?? null;
  }

  async function liveImage(handle) {
    try {
      const res = await fetch(
        `/wp-json/ybb/v1/site-manager/product-live/${encodeURIComponent(handle)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const url = data?.images?.[0];
      return typeof url === "string" && url.length > 0 ? url : null;
    } catch {
      return null;
    }
  }

  async function fixCard(card) {
    const img = card.querySelector("img");
    const handle = handleFromCard(card);
    if (!img || !handle) return;

    const apply = (src) => {
      if (!src || img.src === src) return;
      img.src = src;
    };

    const woo = await liveImage(handle);
    if (woo) {
      apply(woo);
      return;
    }
    apply(MASTER(handle));
  }

  function boot() {
    const cards = document.querySelectorAll(".product-card");
    cards.forEach((card) => {
      const img = card.querySelector("img");
      if (!img) return;
      img.addEventListener(
        "error",
        () => {
          void fixCard(card);
        },
        { once: true }
      );
      if (img.complete && img.naturalWidth === 0) {
        void fixCard(card);
      }
    });
    // Proactively refresh from Woo (same source as PDP) even when static src loads
    cards.forEach((card) => {
      void fixCard(card);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
