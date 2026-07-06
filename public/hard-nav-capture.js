(function () {
  function isEmptyCollectionPage() {
    if (document.querySelector('[data-collection-empty="true"]')) return true;
    var body = document.body && document.body.innerText;
    if (!body) return false;
    return (
      body.indexOf("该类目暂无商品") !== -1 ||
      body.indexOf("No products in this category yet.") !== -1 ||
      body.indexOf("このカテゴリには商品がありません") !== -1
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      if (!isEmptyCollectionPage()) return;

      var anchor =
        event.target && event.target.closest && event.target.closest("a[href]");
      if (!anchor || anchor.target === "_blank") return;

      var href = anchor.getAttribute("href");
      if (!href || href.charAt(0) !== "/") return;

      var current = location.pathname + location.search;
      if (href === current) return;

      event.preventDefault();
      event.stopPropagation();
      location.assign(href);
    },
    true
  );
})();
