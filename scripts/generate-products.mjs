import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, "../../assets-manifest.csv");
const outProducts = join(__dirname, "../lib/data/products.json");
const outCollections = join(__dirname, "../lib/data/collections.json");

const PLACEHOLDER = "/images/placeholder-product.jpg";

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inferCollection(handle, titleEn, folderCn) {
  const s = `${handle} ${titleEn} ${folderCn}`.toLowerCase();
  if (/tackle-bag|渔具包/.test(s)) return "tackle-bags";
  if (/hooklength-box|子线盒/.test(s)) return "hooklength-boxes";
  if (/bait-cage|feeder|饵笼|飞德|method|b1073|a1144f|j105/.test(s))
    return "bait-cages";
  if (/hooklink|钩子线|子线(?!盒)/.test(s)) return "hooklinks";
  if (/aligner|偏转件|tube|尾尖管|connector/.test(s)) return "aligners";
  if (/lead-weight|铅坠|铅芯|leadcore|qc-leadcore|screw-slider|shot/.test(s))
    return "leadcore";
  if (/swivel.*lead|转环.*铅|submarine/.test(s)) return "swivel-leads";
  if (/catfish|鲶鱼/.test(s)) return "catfish-rigs";
  if (/sea-fishing|sea fishing|海钓|treble|lure/.test(s)) return "sea-fishing";
  if (/wire/.test(s)) return "wire-traces";
  if (/float|浮漂/.test(s)) return "terminal-tackle";
  if (/rig|钓组|ronnie|chod|combi/.test(s)) return "ready-rigs";
  if (/stand|支架|rack/.test(s)) return "tackle-storage";
  if (/baiting|穿饵|needle|tool/.test(s)) return "terminal-tackle";
  return "terminal-tackle";
}

function mockPrice(handle) {
  const h = hashCode(handle);
  const base = 3.5 + (h % 450) / 10;
  return Math.round(base * 100) / 100;
}

const collectionMeta = {
  "new-arrivals": {
    title: "New Arrivals",
    titleCn: "新品上架",
    description: "Latest terminal tackle from YBB factory catalog.",
  },
  "sample-kits": {
    title: "Sample Kits",
    titleCn: "样品套装",
    description: "Curated sample packs for wholesale buyers.",
  },
  "terminal-tackle": {
    title: "Terminal Tackle",
    titleCn: "终端钓具",
    description: "Hooks, rigs, floats and core terminal components.",
  },
  "ready-rigs": {
    title: "Ready Rigs",
    titleCn: "成品钓组",
    description: "Pre-tied carp and coarse fishing rigs.",
  },
  hooklinks: {
    title: "Hooklinks",
    titleCn: "钩子线 / 子线",
    description: "Hooklink systems and hooklength sets.",
  },
  aligners: {
    title: "Aligners & Tubes",
    titleCn: "偏转件与套管",
    description: "Aligners, anti-tangle sleeves and rig tubes.",
  },
  "swivel-leads": {
    title: "Swivel Leads",
    titleCn: "转环铅坠",
    description: "Swivel-attached leads and weight systems.",
  },
  leadcore: {
    title: "Leadcore Systems",
    titleCn: "铅芯线系统",
    description: "Leadcore rigs, sliders and weight components.",
  },
  "bait-care": {
    title: "Bait Care",
    titleCn: "饵料护理",
    description: "Feeders, bait cages and baiting accessories.",
  },
  "method-feeders": {
    title: "Method Feeders",
    titleCn: "方法饵笼",
    description: "Method and feeder fishing tackle.",
  },
  "bait-cages": {
    title: "Bait Cages",
    titleCn: "饵笼系列",
    description: "Bait cages, feeders and cage rig systems.",
  },
  "tackle-storage": {
    title: "Tackle Storage",
    titleCn: "渔具收纳",
    description: "Racks, stands and storage hardware.",
  },
  "hooklength-boxes": {
    title: "Hooklength Boxes",
    titleCn: "子线盒",
    description: "Hooklength storage boxes in multiple sizes.",
  },
  "tackle-bags": {
    title: "Tackle Bags",
    titleCn: "渔具包",
    description: "Factory-direct tackle bags for retail and wholesale.",
  },
  "sea-fishing": {
    title: "Sea & Predator",
    titleCn: "海钓与掠食",
    description: "Sea fishing rigs, lures and traces.",
  },
  "catfish-rigs": {
    title: "Catfish Float Rigs",
    titleCn: "鲶鱼浮漂钓组",
    description: "Catfish float and predator rig systems.",
  },
  "wire-traces": {
    title: "Wire Traces",
    titleCn: "钢丝前导线",
    description: "Wire traces for sea and predator fishing.",
  },
};

const csv = readFileSync(csvPath, "utf-8");
const rows = parseCsv(csv);

const products = rows.map((row, index) => {
  const handle = row.handle;
  const price = mockPrice(handle);
  const onSale = hashCode(handle) % 3 === 0;
  const compareAtPrice = onSale
    ? Math.round(price * 1.25 * 100) / 100
    : undefined;
  const collection = inferCollection(
    handle,
    row.title_en,
    row.folder_name_cn
  );
  const tags = ["wholesale", "factory-direct"];
  if (row.status === "ready") tags.push("has-video");
  if (index < 12) tags.push("new-arrival");

  return {
    handle,
    title: row.title_en,
    titleCn: row.folder_name_cn,
    price,
    ...(compareAtPrice ? { compareAtPrice } : {}),
    images: [PLACEHOLDER],
    sourceImage: row.primary_image,
    ...(row.video_path ? { video: row.video_path } : {}),
    collection,
    available: true,
    tags,
    imageCount: Number(row.image_count) || 1,
  };
});

const counts = {};
for (const p of products) {
  counts[p.collection] = (counts[p.collection] || 0) + 1;
}

const newArrivalHandles = products
  .filter((p) => p.tags.includes("new-arrival"))
  .map((p) => p.handle);

const collections = Object.entries(collectionMeta).map(([handle, meta]) => {
  const productHandles =
    handle === "new-arrivals"
      ? newArrivalHandles
      : products.filter((p) => p.collection === handle).map((p) => p.handle);
  return {
    handle,
    ...meta,
    productCount: productHandles.length,
    productHandles,
  };
});

writeFileSync(outProducts, JSON.stringify(products, null, 2) + "\n");
writeFileSync(outCollections, JSON.stringify(collections, null, 2) + "\n");
console.log(`Wrote ${products.length} products, ${collections.length} collections`);
