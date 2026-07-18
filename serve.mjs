import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
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
  '.onnx': 'application/octet-stream',
  '.wasm': 'application/wasm',
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

// Parser simples de "Range: bytes=INICIO-FIM". Só o formato de um intervalo, que é o único
// que fetch()/<video>/download managers geram na prática.
function parseRange(rangeHeader, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || '').trim());
  if (!m) return null;
  const [, startRaw, endRaw] = m;
  if (!startRaw && !endRaw) return null;
  let start = startRaw ? Number(startRaw) : size - Number(endRaw);
  let end = endRaw && startRaw ? Number(endRaw) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) return null;
  return { start, end };
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
    const stat = await fs.stat(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    const baseHeaders = {
      'Content-Type': contentType,
      'Cache-Control': cacheControlFor(urlPath),
      'Service-Worker-Allowed': '/',
      'Accept-Ranges': 'bytes',
    };

    // Modelo de IA e o runtime wasm passam de 10MB -- sem streaming + Range, uma queda de rede no
    // celular (o cenário que essa prévia mobile existe pra cobrir) obriga a pessoa a baixar tudo de
    // novo do zero. Os demais arquivos (bem menores) seguem lidos inteiros, mais simples.
    const range = req.headers.range ? parseRange(req.headers.range, stat.size) : null;
    if (range) {
      res.writeHead(206, { ...baseHeaders, 'Content-Length': range.end - range.start + 1, 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}` });
      createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Erro interno');
  }
});

server.listen(PORT, () => {
  console.log(`Terê Studio Portal — servindo ${DIST_DIR} na porta ${PORT}`);
});
