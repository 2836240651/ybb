import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PW_ROOT = path.join(__dirname, "..");
const AUTH_FILE = path.join(PW_ROOT, "shopify-auth.json");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9222;
const PROFILE_DIR = path.join(PW_ROOT, "chrome-real-profile");

function getStore() {
  return loadConfig().store;
}

async function connectCdpBrowser() {
  return chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
}

async function launchFreshBrowser() {
  if (fs.existsSync(CHROME)) {
    return chromium.launch({
      channel: "chrome",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  }
  return chromium.launch({ headless: false });
}

async function launchBrowser() {
  try {
    return await connectCdpBrowser();
  } catch {
    return launchFreshBrowser();
  }
}

export {
  launchBrowser,
  launchFreshBrowser,
  connectCdpBrowser,
  AUTH_FILE,
  CDP_PORT,
  PROFILE_DIR,
  CHROME,
  PW_ROOT,
  getStore,
};
