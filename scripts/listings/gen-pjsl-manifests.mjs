import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const shared = JSON.parse(
  fs.readFileSync(path.join(dir, "_pjsl-buffer-shared.json"), "utf8")
);

const colors = [
  {
    sku: "TZ-PJSL-001",
    handle: "tz-pjsl-001",
    color: "yellow",
    image:
      "https://carp-ybb.com/wp-content/uploads/2026/06/TZ-PJSL-001-1.jpeg",
    titleSuffix: " — Yellow",
  },
  {
    sku: "TZ-PJSL-002",
    handle: "tz-pjsl-002",
    color: "green",
    image:
      "https://carp-ybb.com/wp-content/uploads/2026/06/TZ-PJSL-002-1.jpeg",
    titleSuffix: " — Green",
  },
  {
    sku: "TZ-PJSL-003",
    handle: "tz-pjsl-003",
    color: "grey",
    image:
      "https://carp-ybb.com/wp-content/uploads/2026/06/TZ-PJSL-003-1.jpeg",
    titleSuffix: " — Grey",
  },
];

for (const c of colors) {
  const product = {
    skuBase: c.sku,
    handle: c.handle,
    title: shared.title + c.titleSuffix,
    nameEn: shared.title + c.titleSuffix,
    titleZh: shared.titleZh,
    nameZh: shared.titleZh,
    titleJa: shared.titleJa,
    nameJa: shared.titleJa,
    shortDescription: shared.shortDescription,
    description: shared.description,
    descriptionHtml: shared.descriptionHtml,
    descriptionZh: shared.descriptionZh,
    descriptionZhHtml: shared.descriptionZhHtml,
    descriptionJa: shared.descriptionJa,
    descriptionJaHtml: shared.descriptionJaHtml,
    sloganEn: shared.sloganEn,
    sloganZh: shared.sloganZh,
    sloganJa: shared.sloganJa,
    hideSlogan: false,
    frontHidden: false,
    galleryEnabled: true,
    galleryOverrideEnabled: false,
    hideDescription: false,
    hideAdditionalInfo: false,
    category: "Plastic Accessories",
    categoryMain: "Other",
    categorySub: "Plastic Accessories",
    published: true,
    attributeName: "Pack Size",
    variants: [
      {
        sku: `${c.sku}-${c.color}-30pcs`,
        parentSku: c.sku,
        option: "30pcs",
        price: "5.70",
      },
      {
        sku: `${c.sku}-${c.color}-60pcs`,
        parentSku: c.sku,
        option: "60pcs",
        price: "10.80",
      },
    ],
    imageUrls: [c.image],
    imageUrl: c.image,
    sheet: "配件-塑料",
    source: `agent-json ${c.sku} transparent buffer tube`,
  };

  const manifest = {
    format: "wc-v2-existing-update",
    source: `agent-json ${c.sku} quick change buffer sleeve`,
    sheets: [{ name: "商品主表", products: [product] }],
  };

  fs.writeFileSync(
    path.join(dir, `${c.handle}-manifest.json`),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  console.log("wrote", c.handle);
}
