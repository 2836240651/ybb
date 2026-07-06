/**
 * Generate gallery-1..gallery-N webp variants for benchmark PDP masonry.
 * Usage: node scripts/generate-pdp-gallery.mjs [handle] [count]
 */
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const handle = process.argv[2] ?? "three-way-swivel-kit-box";
const count = Number(process.argv[3] ?? 29);
const outDir = join(process.cwd(), "public/products", handle);
const masterPath = join(outDir, "master.webp");

if (!existsSync(masterPath)) {
  console.error("master.webp not found:", masterPath);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const meta = await sharp(masterPath).metadata();
const baseW = meta.width ?? 1200;
const baseH = meta.height ?? 1200;

/** Deterministic crop/zoom variants so each gallery-N is a distinct file. */
function variantParams(index) {
  const slot = index - 1;
  const zoom = 1.05 + (slot % 7) * 0.04;
  const cropW = Math.round(baseW / zoom);
  const cropH = Math.round(baseH / zoom);
  const maxLeft = Math.max(0, baseW - cropW);
  const maxTop = Math.max(0, baseH - cropH);
  const left = Math.round((slot * 37) % (maxLeft + 1));
  const top = Math.round((slot * 53) % (maxTop + 1));
  const rotate = ((slot % 5) - 2) * 0.4;
  const brightness = 0.96 + (slot % 6) * 0.012;
  const saturation = 0.94 + (slot % 4) * 0.03;
  const aspect = slot % 3 === 0 ? { w: 800, h: 1000 } : { w: 900, h: 900 };
  return { left, top, cropW, cropH, rotate, brightness, saturation, aspect };
}

let created = 0;
let skipped = 0;

for (let i = 1; i <= count; i++) {
  const dest = join(outDir, `gallery-${i}.webp`);
  if (existsSync(dest)) {
    skipped++;
    continue;
  }

  const v = variantParams(i);
  const pipeline = sharp(masterPath)
    .rotate(v.rotate, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extract({ left: v.left, top: v.top, width: v.cropW, height: v.cropH })
    .resize(v.aspect.w, v.aspect.h, { fit: "cover", position: "centre" })
    .modulate({ brightness: v.brightness, saturation: v.saturation })
    .webp({ quality: 82 });

  await pipeline.toFile(dest);
  created++;
  console.log("✓", dest);
}

console.log(`Done: ${created} created, ${skipped} skipped (${count} slots)`);
