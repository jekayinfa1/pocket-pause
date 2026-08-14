import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = file => readFile(path.join(root, file), 'utf8');
const coreFiles = ['index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.webmanifest'];

for (const file of coreFiles) await access(path.join(root, file));

const [html, app, serviceWorker, manifestText] = await Promise.all([
  readText('index.html'),
  readText('app.js'),
  readText('sw.js'),
  readText('manifest.webmanifest')
]);
const manifest = JSON.parse(manifestText);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateIds)], [], `Duplicate HTML IDs: ${duplicateIds.join(', ')}`);

assert.equal(manifest.start_url, './', 'PWA start_url must remain repository-relative.');
assert.equal(manifest.scope, './', 'PWA scope must remain repository-relative.');
assert.equal(manifest.display, 'standalone', 'PWA display mode must remain standalone.');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'The PWA needs at least one icon.');

const htmlAssets = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1]);
const manifestAssets = [
  ...manifest.icons.map(icon => icon.src),
  ...(manifest.screenshots || []).map(screenshot => screenshot.src),
  ...(manifest.shortcuts || []).flatMap(shortcut => (shortcut.icons || []).map(icon => icon.src))
];
const normalizeAsset = value => value.replace(/^\.\//, '').split(/[?#]/)[0];
const localAssets = [...htmlAssets, ...manifestAssets]
  .filter(value => !/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value))
  .map(normalizeAsset)
  .filter(Boolean);

for (const asset of new Set(localAssets)) {
  await access(path.join(root, asset));
}

const shellAssets = [...serviceWorker.matchAll(/["']\.\/([^"']+)["']/g)]
  .map(match => normalizeAsset(match[1]))
  .filter(Boolean);
for (const asset of new Set(shellAssets)) {
  await access(path.join(root, asset));
}

assert.match(app, /localStorage/, 'PocketPause should retain its local-first storage model.');
assert.doesNotMatch(app, /XMLHttpRequest|WebSocket/, 'The client should not silently transmit financial context.');

for (const script of ['app.js', 'sw.js', 'scripts/dev-server.mjs', 'scripts/build-pages.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, script)], { stdio: 'inherit' });
}

console.log(`Validated ${ids.length} unique DOM IDs, ${new Set(localAssets).size} local assets, and all JavaScript syntax.`);
