/**
 * Open carp-ybb.com wp-login in a dedicated Chrome profile (pass SG-Captcha, then admin).
 *
 * Usage:
 *   node scripts/open-wp-admin-chrome.mjs
 */
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
  process.env.YBB_WP_CHROME_PROFILE ||
  path.join(LOCAL_APP_DATA, "ybb-wp-admin-chrome-profile");

const secrets = JSON.parse(fs.readFileSync(SECRETS, "utf8"));
const site = secrets?.wordpress?.siteUrl || "https://carp-ybb.com";
const loginUrl = `${site.replace(/\/$/, "")}/wp-login.php`;
const homeUrl = `${site.replace(/\/$/, "")}/`;

fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log("Launch Chrome for WordPress admin (SG-Captcha friendly)...");
console.log(`Profile : ${PROFILE_DIR}`);
console.log(`Home    : ${homeUrl}`);
console.log(`Login   : ${loginUrl}`);
console.log("");
console.log("1. Wait for homepage security check to finish.");
console.log("2. Log in at wp-login.php.");
console.log("3. If dashboard is blank, open /wp-admin/index.php after captcha clears.");
console.log("4. Or SiteGround Site Tools -> WordPress -> Log in to Admin.");

spawn(
  CHROME,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--new-window",
    loginUrl,
  ],
  { detached: true, stdio: "ignore" }
).unref();
