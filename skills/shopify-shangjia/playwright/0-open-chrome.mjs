import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "./lib/config.mjs";
import { CHROME, CDP_PORT, PROFILE_DIR } from "./lib/browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig();
const LOGIN_URL = `https://admin.shopify.com/store/${cfg.store}`;

if (!fs.existsSync(CHROME)) {
  console.error("未找到 Google Chrome");
  process.exit(1);
}
fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log("启动真实 Chrome 登录 Shopify...");
console.log(`店铺: ${LOGIN_URL}`);
console.log(`登录后运行: npm run capture`);

spawn(
  CHROME,
  [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE_DIR}`, "--no-first-run", LOGIN_URL],
  { detached: true, stdio: "ignore" }
).unref();
