import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || (process.env.CODESPACES === 'true' ? '0.0.0.0' : '127.0.0.1');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon']
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(root, `.${requested}`);
  return resolved.startsWith(`${root}${path.sep}`) || resolved === root ? resolved : null;
}

const server = createServer(async (request, response) => {
  try {
    let filePath = safePath(request.url || '/');
    if (!filePath) {
      response.writeHead(400).end('Bad request');
      return;
    }

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      filePath = path.join(root, 'index.html');
      fileStat = await stat(filePath);
    }

    if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    const type = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';

    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self';"
    });

    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end('Internal server error');
  }
});

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`PocketPause is running at http://${displayHost}:${port}`);
  if (process.env.CODESPACES === 'true') {
    console.log(`Open the forwarded port ${port} from the Codespaces Ports panel.`);
  }
  console.log('Press Ctrl+C to stop.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
