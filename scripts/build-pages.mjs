import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const entries = [
  'index.html',
  'privacy.html',
  'app.js',
  'styles.css',
  'sw.js',
  'manifest.webmanifest',
  'assets'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  try {
    await access(source);
    await cp(source, path.join(dist, entry), { recursive: true });
  } catch (error) {
    if (entry !== 'privacy.html') throw error;
  }
}

await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built static site in ${dist}`);
