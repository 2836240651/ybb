import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "./lib/config.mjs";
import { AUTH_FILE, CDP_PORT } from "./lib/browser.mjs";

const cfg = loadConfig();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
const context = browser.contexts()[0];
if (!context) {
  console.error("无法连接 Chrome，请先 npm run open-chrome");
  process.exit(1);
}
await context.storageState({ path: AUTH_FILE });
console.log("登录态已保存:", AUTH_FILE);
await browser.close();
