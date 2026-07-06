import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(
  path.resolve(__dirname, "../../scripts/omc-home.html"),
  "utf8"
);
const m = html.match(
  /<ul class="payment-icons[^"]*"[^>]*>([\s\S]*?)<\/ul>/
);
if (!m) {
  console.error("payment-icons ul not found");
  process.exit(1);
}
const svgs = [...m[1].matchAll(/<svg[\s\S]*?<\/svg>/g)];
console.log("count", svgs.length);
const outDir = path.resolve(__dirname, "../components/layout/payment-icons");
fs.mkdirSync(outDir, { recursive: true });
svgs.forEach((match, i) => {
  const svg = match[0];
  const id =
    svg.match(/aria-labelledby="([^"]+)"/)?.[1] ||
    svg.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] ||
    `icon-${i}`;
  const name = id.replace(/^pi-/, "").replace(/_/g, "-");
  console.log(i + 1, name);
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg);
});
