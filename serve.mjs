import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

// sw.js e o manifest nunca podem ficar em cache agressivo -- é assim que o navegador descobre
// uma versão nova do app. Hash nos assets do Vite (/assets/*) já garante nome novo a cada
// build, esses sim podem (e devem) ficar em cache por muito tempo.
function cacheControlFor(urlPath) {
  if (urlPath === '/sw.js' || urlPath === '/manifest.webmanifest' || urlPath === '/index.html' || urlPath === '/') {
    return 'no-cache';
  }
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

async function resolveFile(urlPath) {
  const safeRel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safeRel);
  if (!filePath.startsWith(DIST_DIR)) return null;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) return filePath;
  } catch {}
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let urlPath = url.pathname === '/' ? '/index.html' : url.pathname;
    let filePath = await resolveFile(urlPath);
    // Sem rota client-side hoje (é um app de tela única), mas fallback pro index.html em
    // qualquer caminho desconhecido evita 404 feio se isso mudar no futuro.
    if (!filePath) { urlPath = '/index.html'; filePath = await resolveFile(urlPath); }
    if (!filePath) { res.writeHead(404); res.end('Não encontrado'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControlFor(urlPath),
      'Service-Worker-Allowed': '/',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end('Erro interno');
  }
});

server.listen(PORT, () => {
  console.log(`Terê Studio Portal — servindo ${DIST_DIR} na porta ${PORT}`);
});
