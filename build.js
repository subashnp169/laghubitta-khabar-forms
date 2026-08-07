/**
 * Build script — generates every deploy artifact from the single sources:
 *   src/portal.html  (public portal; uses __SCRIPT_URL__ placeholder)
 *   Code.gs          (backend, Apps Script)
 *   studio.html      (admin studio)
 *
 * Outputs:
 *   index.html         -> repo root (GitHub Pages mirror)
 *   blogger-page.html  -> paste into Blogger (iframe wrapper around the portal)
 *   appscript/Code.gs  -> paste into Apps Script
 *   appscript/studio.html -> paste into Apps Script as file "Index"
 *   dist/              -> Cloudflare Pages output
 *
 * Usage: node build.js
 * Edit site-config.json first to set your Apps Script URL + portal URL.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const STATIC = ["logo.webp"];

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}
function write(p, content) {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log("wrote " + p);
}

const cfg = JSON.parse(read("site-config.json"));
const scriptUrl = String(cfg.scriptUrl || "").trim();
const portalUrl = String(cfg.portalUrl || "").trim();

if (!scriptUrl || scriptUrl.indexOf("PASTE_YOUR") !== -1) {
  console.error("site-config.json: set a real scriptUrl first.");
  process.exit(1);
}

// 1) Portal (root for GitHub Pages + dist/ for Cloudflare)
let portal = read("src/portal.html");
if (portal.indexOf("__SCRIPT_URL__") === -1) {
  console.error("src/portal.html is missing the __SCRIPT_URL__ placeholder.");
  process.exit(1);
}
portal = portal.split("__SCRIPT_URL__").join(scriptUrl);
write("index.html", portal);
write("dist/index.html", portal);

// 2) blogger-page.html — generated iframe wrapper (replaces the old full copy)
write("blogger-page.html", read("src/blogger-template.html").replace("__PORTAL_URL__", portalUrl));

// 3) appscript/ — paste-ready copies
write("appscript/Code.gs", read("Code.gs"));
write("appscript/studio.html", read("studio.html"));

// 4) dist/ — static assets + cache headers for Cloudflare
STATIC.forEach((f) => {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ROOT, "dist", f));
});
write("dist/_headers", "/\n  X-Frame-Options: SAMEORIGIN\n  Cache-Control: public, max-age=0, must-revalidate\n/index.html\n  Cache-Control: public, max-age=0, must-revalidate\n/*.webp\n  Cache-Control: public, max-age=604800\n");

console.log("\nBuild complete.");
console.log("  Paste appscript/Code.gs + appscript/studio.html into Apps Script (file 'Index').");
console.log("  Deploy dist/ to Cloudflare Pages (or push repo root to GitHub Pages).");
console.log("  Update the Blogger page with blogger-page.html (iframe wrapper).");
