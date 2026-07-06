import { readdirSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const handle = "three-way-swivel-kit-box";
const srcDir = "E:\\迅雷云盘\\产品原图素材\\带铁三叉节套盒";
const outDir = join(process.cwd(), "public/products", handle);

if (!existsSync(srcDir)) {
  console.error("Source folder not found:", srcDir);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir)
  .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .slice(0, 4);

for (let i = 0; i < files.length; i++) {
  const dest = join(outDir, `gallery-${i + 1}.webp`);
  await sharp(join(srcDir, files[i]))
    .rotate()
    .resize(800, 1000, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(dest);
  console.log("✓", dest);
}

await sharp(join(srcDir, files[0]))
  .rotate()
  .resize(1200, 1200, { fit: "cover" })
  .webp({ quality: 82 })
  .toFile(join(outDir, "master.webp"));

console.log("Done:", files.length, "gallery images");
