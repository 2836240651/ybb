/**
 * Restore SiteGround session into Cursor browser tab via CDP Runtime.evaluate.
 * Usage (after navigating to https://my.siteground.com/):
 *   node scripts/restore-siteground-session.mjs
 * Then paste printed snippet into browser automation, or run via agent CDP.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sessionPath = join(root, "deploy", "siteground-browser-session.json");
const session = JSON.parse(readFileSync(sessionPath, "utf8"));

const payload = {
  localStorage: session.localStorage ?? {},
  sessionStorage: session.sessionStorage ?? {},
  documentCookie: session.documentCookieFlags?.logged_client_id
    ? `logged_client_id=${session.documentCookieFlags.logged_client_id}`
    : "",
};

const snippet = `(() => {
  const data = ${JSON.stringify(payload)};
  for (const [k, v] of Object.entries(data.localStorage || {})) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  for (const [k, v] of Object.entries(data.sessionStorage || {})) {
    try { sessionStorage.setItem(k, v); } catch (e) {}
  }
  if (data.documentCookie) {
    document.cookie = data.documentCookie + '; path=/; domain=.siteground.com; secure; samesite=lax';
  }
  return 'siteground-session-restored';
})()`;

console.log(snippet);
