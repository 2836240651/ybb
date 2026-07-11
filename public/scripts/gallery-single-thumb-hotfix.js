/**
 * Hotfix: show bottom thumbnail strip when gallery has a single Woo image.
 * Remove after next full static rebuild includes ProductMediaGallery fix.
 */
(function () {
  function run() {
    var root = document.querySelector("[data-gallery-layout]");
    if (!root) return;
    var count = Number(root.getAttribute("data-gallery-count") || "0");
    if (count !== 1) return;
    if (root.querySelector(".product__thumbnails")) return;

    var mainImg = root.querySelector(".product__media-main img");
    if (!mainImg || !mainImg.src) return;

    var strip = document.createElement("div");
    strip.className = "product__thumbnails product__thumbnails--below w-full";
    strip.innerHTML =
      '<div class="product__thumbnails-list scroll-area flex gap-4 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-thin" aria-label="Product thumbnails">' +
      '<button type="button" class="product__thumbnail relative shrink-0 overflow-hidden rounded-[10px] aspect-square w-20 ring-2 ring-foreground ring-offset-1 opacity-100" aria-current="true" aria-label="View image 1 of 1">' +
      '<img src="' +
      mainImg.src +
      '" alt="" class="rounded-[10px] object-contain p-1 mix-blend-multiply pointer-events-none w-full h-full" />' +
      "</button></div>";

    var host = root.querySelector(".product__media-all");
    if (host) host.appendChild(strip);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
