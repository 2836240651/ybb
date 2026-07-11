import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const shared = {
  titleBase:
    "Carp Fishing Hook Rig Storage Board Hooklength Organizer Box",
  titleZh: "鲤鱼钓子线收纳板 鱼钩绕线收纳盒 Hooklength整理盒",
  titleJa: "カープフィッシング フックリグ収納ボード フックレングスケース",
  shortDescription:
    "Professional hooklength storage board keeps pre-tied rigs organized, protected and ready for fishing. OEM & wholesale available.",
  descriptionEn: `The Carp Fishing Hook Rig Storage Board is designed for anglers who want to organize pre-tied hooklengths safely and efficiently. The lightweight storage board keeps rigs straight, prevents tangles and allows quick rig selection during fishing.

Made from durable plastic, it securely holds hooks and leaders while protecting sharp hook points during transport. Multiple color options make it easy to separate different hook sizes and rig types.

Suitable for carp fishing, feeder fishing and coarse fishing. An excellent accessory for anglers, tackle retailers and OEM fishing tackle brands.

Key Features
• Keeps hooklengths organized
• Prevents line tangles
• Protects hook points
• Lightweight & durable plastic
• Multiple color options
• Easy rig identification
• OEM & ODM supported
• Wholesale supply available

Conclusion
A practical storage solution for keeping carp fishing rigs organized, protected and ready for your next session.`,
  descriptionZh: `鲤鱼钓子线收纳板专为整理已绑好的鱼钩及子线而设计，可有效防止缠绕，保持钓组整齐，方便随时取用。

采用轻量化高强度塑料制成，可牢固固定鱼钩及子线，同时保护钩尖，避免运输过程中相互缠绕或损坏。不同颜色便于区分不同型号、长度及钓组类型。

适用于鲤鱼钓、Feeder钓及淡水钓鱼，是钓鱼爱好者、渔具经销商及OEM品牌的理想配件。

产品特点
• 整齐收纳子线
• 防止缠线打结
• 保护鱼钩钩尖
• 轻量耐用塑料材质
• 多颜色分类管理
• 快速识别不同钓组
• 支持OEM/ODM
• 全球批发供应

总结
帮助钓手高效管理预绑钓组，让每一次作钓都更加整洁、高效。`,
  descriptionJa: `フックリグ収納ボードは、結束済みフックリグやリーダーを整理・保護するために設計されています。

丈夫なプラスチック製で、ラインの絡みを防ぎ、フックポイントを保護します。色分けにより異なるリグを簡単に管理できます。

カープフィッシング、フィーダーフィッシングなど幅広く対応します。

特徴
• リグをきれいに収納
• ライントラブル防止
• フックポイント保護
• 軽量で丈夫
• 複数カラー展開
• OEM・ODM対応
• 卸売対応

まとめ
リグ管理を効率化する便利なフィッシングアクセサリーです。`,
  sloganEn:
    "Professional hooklength storage board keeps pre-tied rigs organized, protected and ready for fishing. OEM & wholesale available.",
  sloganZh:
    "专业子线收纳板，可整齐收纳已绑好鱼钩及子线，方便携带，支持OEM、ODM及批发采购。",
  sloganJa:
    "結束済みリグを整理・保護できるフックレングス収納ボード。OEM・卸売対応。",
};

function paragraphsToHtml(text) {
  return text
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      if (block.startsWith("Key Features") || block.startsWith("产品特点") || block.startsWith("特徴")) {
        const [head, ...lines] = block.split("\n");
        const items = lines
          .filter((line) => line.startsWith("•"))
          .map((line) => line.replace(/^•\s*/, ""))
          .join("<br>• ");
        return `<p>${head}<br>• ${items}</p>`;
      }
      if (block.startsWith("Conclusion") || block.startsWith("总结") || block.startsWith("まとめ")) {
        const [head, ...rest] = block.split("\n");
        return `<p>${head}<br>${rest.join(" ")}</p>`;
      }
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

const parents = [
  {
    sku: "TZ-ZBSB-020",
    handle: "tz-zbsb-020",
    modelSuffix: " — Long",
    zhModel: "（长）",
    colors: ["blue", "yellow", "green"],
  },
  {
    sku: "TZ-ZBSB-021",
    handle: "tz-zbsb-021",
    modelSuffix: " — Short",
    zhModel: "（短）",
    colors: ["red", "yellow", "blue", "green"],
  },
];

for (const parent of parents) {
  const product = {
    skuBase: parent.sku,
    handle: parent.handle,
    title: shared.titleBase + parent.modelSuffix,
    nameEn: shared.titleBase + parent.modelSuffix,
    titleZh: shared.titleZh + parent.zhModel,
    nameZh: shared.titleZh + parent.zhModel,
    titleJa: shared.titleJa + parent.modelSuffix,
    nameJa: shared.titleJa + parent.modelSuffix,
    shortDescription: shared.shortDescription,
    description: shared.descriptionEn,
    descriptionHtml: paragraphsToHtml(shared.descriptionEn),
    descriptionZh: shared.descriptionZh,
    descriptionZhHtml: paragraphsToHtml(shared.descriptionZh),
    descriptionJa: shared.descriptionJa,
    descriptionJaHtml: paragraphsToHtml(shared.descriptionJa),
    sloganEn: shared.sloganEn,
    sloganZh: shared.sloganZh,
    sloganJa: shared.sloganJa,
    hideSlogan: false,
    frontHidden: false,
    galleryEnabled: true,
    galleryOverrideEnabled: false,
    hideDescription: false,
    hideAdditionalInfo: false,
    category: "Peripheral Equipment",
    categoryMain: "Other",
    categorySub: "Peripheral Equipment",
    published: true,
    attributeName: "Color",
    variants: parent.colors.map((color) => ({
      sku: `${parent.sku}-${color}`,
      parentSku: parent.sku,
      option: color,
      price: "1.99",
    })),
    imageUrls: [],
    imageUrl: "",
    sheet: "周边设备",
    source: `agent-json ${parent.sku} hooklength storage board`,
  };

  const manifest = {
    format: "wc-v2-existing-update",
    source: `agent-json ${parent.sku} hook rig storage board`,
    sheets: [{ name: "商品主表", products: [product] }],
  };

  fs.writeFileSync(
    path.join(dir, `${parent.handle}-manifest.json`),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  console.log("wrote", parent.handle);
}
