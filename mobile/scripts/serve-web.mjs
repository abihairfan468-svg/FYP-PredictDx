// Serves the built mobile app (build/web) so it can be opened in a browser or a phone on the same Wi-Fi.
//   flutter build web  →  node scripts/serve-web.mjs  →  http://localhost:5174
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'build', 'web');
const port = Number(process.env.PORT ?? 5174);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.otf': 'font/otf', '.ttf': 'font/ttf', '.bin': 'application/octet-stream', '.frag': 'text/plain',
};

if (!existsSync(join(root, 'index.html'))) {
  console.log('Mobile app not built yet - run "flutter build web" in the mobile folder (see mobile/README.md).');
  process.exit(0);
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '');
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`PredictDx mobile app: http://localhost:${port}`);
  // the addresses a phone on the same Wi-Fi can open
  for (const [name, nets] of Object.entries(networkInterfaces())) {
    if (/vmware|virtual|vethernet|bluetooth/i.test(name)) continue;
    for (const n of nets ?? []) {
      if (n.family === 'IPv4' && !n.internal && /^(192\.168|10\.)/.test(n.address)) console.log(`  on your phone (same Wi-Fi): http://${n.address}:${port}  (website: http://${n.address}:5173)`);
    }
  }
});
