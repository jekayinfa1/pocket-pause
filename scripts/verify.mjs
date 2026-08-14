import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "privacy.html",
  "assets/icon.svg"
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

const index = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");
const serviceWorker = readFileSync("sw.js", "utf8");
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));

const checks = [
  [index.includes('id="pauseForm"'), "Purchase pause form is missing"],
  [index.includes('id="memeCard"'), "Meme intervention surface is missing"],
  [index.includes('id="insightsView"'), "Insights surface is missing"],
  [index.includes('id="remindersView"'), "Reminder surface is missing"],
  [app.includes("makeIntervention"), "Context-aware intervention engine is missing"],
  [app.includes("matchingRule"), "Reminder matching logic is missing"],
  [app.includes("navigator.geolocation"), "Optional local location support is missing"],
  [app.includes("localStorage"), "Local persistence is missing"],
  [app.includes("exportData"), "Data export is missing"],
  [serviceWorker.includes("caches.open"), "Offline cache is missing"],
  [manifest.start_url === "./", "Manifest start_url must remain relative for GitHub Pages"],
  [manifest.scope === "./", "Manifest scope must remain relative for GitHub Pages"],
  [manifest.display === "standalone", "Manifest must be installable as standalone"]
];

for (const [passed, message] of checks) {
  if (!passed) failures.push(message);
}

if (/<script[^>]+src=["']https?:\/\//i.test(index)) {
  failures.push("Remote runtime scripts are not allowed");
}

const combined = [index, app, serviceWorker].join("\n");
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/
];
if (secretPatterns.some(pattern => pattern.test(combined))) {
  failures.push("Potential secret detected in source");
}

if (failures.length) {
  console.error("PocketPause verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PocketPause verification passed (${checks.length} capability checks, ${requiredFiles.length} required files).`);
