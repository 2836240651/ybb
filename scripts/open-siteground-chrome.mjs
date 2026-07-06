import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SECRETS = path.join(ROOT, "secrets.local.json");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9224;
const LOCAL_APP_DATA =
  process.env.LOCALAPPDATA ||
  path.join(process.env.USERPROFILE || ROOT, "AppData", "Local");
const PROFILE_DIR =
  process.env.SITEGROUND_CHROME_PROFILE ||
  path.join(LOCAL_APP_DATA, "ybb-siteground-chrome-profile");

const secrets = JSON.parse(fs.readFileSync(SECRETS, "utf8"));
const siteId = secrets?.deploy?.siteToolsSiteId;
const loginUrl = secrets?.siteground?.loginUrl || "https://my.siteground.com/";
const fileManagerUrl = siteId
  ? `https://tools.siteground.com/filemanager?siteId=${siteId}`
  : loginUrl;

fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log("Launch Chrome for SiteGround deploy...");
console.log(`Profile: ${PROFILE_DIR}`);
console.log(`Target : ${fileManagerUrl}`);
console.log("After login, run upload script or restore/deploy PowerShell.");

spawn(
  CHROME,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    fileManagerUrl,
  ],
  { detached: true, stdio: "ignore" }
).unref();
