import { clamp, type MaskResult, type Produto } from './types';
import { shapePorProduto } from './normalize';

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    try { img.crossOrigin = 'anonymous'; } catch {}
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não consegui carregar a imagem.'));
    img.src = src;
  });
}
export function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
export function drawRoundedPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 28, fill = '#FFFFFF') {
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}
export function drawImageCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, width: number, height: number, naturalW = 1, naturalH = 1) {
  const nw = Math.max(1, naturalW || 1);
  const nh = Math.max(1, naturalH || 1);
  const scale = Math.max(width / nw, height / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  ctx.drawImage(img, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}
export function drawShapeClipBox(ctx: CanvasRenderingContext2D, xPct: number, yPct: number, wPct: number, hPct: number, shape: string | undefined, box: { x: number; y: number; width: number; height: number }) {
  const x = box.x + box.width * xPct / 100;
  const y = box.y + box.height * yPct / 100;
  const w = box.width * wPct / 100;
  const h = box.height * hPct / 100;
  ctx.beginPath();
  if (shape === 'rect') {
    const r = Math.min(w, h) * 0.08;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return;
  }
  if (shape === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const r = Math.min(w, h) / 2;
  ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
}
export function drawImageContainBox(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, width: number, height: number, naturalW = 1, naturalH = 1): { x: number; y: number; width: number; height: number } {
  const box = fitImageBox(width, height, naturalW, naturalH);
  const out = { x: x + box.left, y: y + box.top, width: box.width, height: box.height };
  ctx.drawImage(img, out.x, out.y, out.width, out.height);
  return out;
}
export function maskBoundsForPreview(mask: MaskResult | undefined, produto?: Produto) {
  const b = mask?.bounds || { xPct: 27, yPct: 34, wPct: 46, hPct: 46 };
  return {
    xPct: clamp(Number(b.xPct || 0), 0, 100),
    yPct: clamp(Number(b.yPct || 0), 0, 100),
    wPct: clamp(Number(b.wPct || 100), 1, 100),
    hPct: clamp(Number(b.hPct || 100), 1, 100),
    shape: mask?.shape || shapePorProduto(produto),
  };
}
export function drawQrModules(ctx: CanvasRenderingContext2D, modules: boolean[][], x: number, y: number, size: number, color = '#111827') {
  const moduleSize = size / Math.max(1, modules.length + 8);
  const quiet = 4;
  ctx.save();
  ctx.fillStyle = color;
  modules.forEach((row, rowIdx) => row.forEach((cell, colIdx) => {
    if (!cell) return;
    ctx.fillRect(x + (colIdx + quiet) * moduleSize, y + (rowIdx + quiet) * moduleSize, moduleSize + 0.2, moduleSize + 0.2);
  }));
  ctx.restore();
}

export type PreviewWatermarkAsset = { imageSrc?: string; text: string };
export function drawPreviewWatermark(ctx: CanvasRenderingContext2D, area: { x: number; y: number; width: number; height: number }, asset: PreviewWatermarkAsset, logoImg?: HTMLImageElement | null) {
  ctx.save();
  roundedRectPath(ctx, area.x, area.y, area.width, area.height, 26);
  ctx.clip();
  ctx.translate(area.x + area.width / 2, area.y + area.height / 2);
  ctx.rotate(-Math.PI / 7.5);
  if (logoImg) {
    const baseW = Math.min(210, area.width * 0.32);
    const baseH = Math.max(48, baseW * ((logoImg.naturalHeight || 1) / Math.max(1, logoImg.naturalWidth || 1)));
    ctx.globalAlpha = 0.08;
    for (let yy = -area.height; yy < area.height; yy += baseH + 80) {
      for (let xx = -area.width; xx < area.width; xx += baseW + 80) {
        ctx.drawImage(logoImg, xx, yy, baseW, baseH);
      }
    }
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.07)';
    ctx.font = '600 44px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (asset.text || 'PRÉVIA').toUpperCase();
    for (let yy = -area.height; yy < area.height; yy += 110) {
      for (let xx = -area.width; xx < area.width; xx += 260) {
        ctx.fillText(label, xx, yy);
      }
    }
  }
  ctx.restore();
}
export function drawPreviewFooterBrand(ctx: CanvasRenderingContext2D, xCenter: number, yTop: number, maxWidth: number, asset: PreviewWatermarkAsset, logoImg?: HTMLImageElement | null, mode: 'single' | 'double' = 'single') {
  ctx.save();
  const lineHalf = mode === 'double' ? Math.min(250, maxWidth * 0.26) : Math.min(190, maxWidth * 0.22);
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xCenter - lineHalf, yTop);
  ctx.lineTo(xCenter + lineHalf, yTop);
  ctx.stroke();
  if (logoImg) {
    const naturalW = Math.max(1, logoImg.naturalWidth || 1);
    const naturalH = Math.max(1, logoImg.naturalHeight || 1);
    const logoW = mode === 'double' ? Math.min(195, maxWidth * 0.20) : Math.min(155, maxWidth * 0.17);
    const logoH = Math.max(mode === 'double' ? 34 : 28, logoW * (naturalH / naturalW));
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logoImg, xCenter - logoW / 2, yTop + 18, logoW, logoH);
    ctx.globalAlpha = 1;
    if (asset.text) {
      ctx.fillStyle = '#6B5A32';
      ctx.font = mode === 'double' ? '500 16px Inter, Arial, sans-serif' : '500 14px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(asset.text, xCenter, yTop + 28 + logoH);
    }
  } else {
    ctx.fillStyle = '#6B5A32';
    ctx.font = mode === 'double' ? '600 22px Inter, Arial, sans-serif' : '600 19px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(asset.text || 'Terê Personalizados', xCenter, yTop + 20);
  }
  ctx.restore();
}

export type ImageFitBox = { left: number; top: number; width: number; height: number };
export function fitImageBox(containerW: number, containerH: number, naturalW = 1, naturalH = 1): ImageFitBox {
  const nw = Math.max(1, naturalW || 1);
  const nh = Math.max(1, naturalH || 1);
  const ratio = nw / nh;
  const containerRatio = containerW / Math.max(1, containerH);
  if (containerRatio > ratio) {
    const height = containerH;
    const width = height * ratio;
    return { left: (containerW - width) / 2, top: 0, width, height };
  }
  const width = containerW;
  const height = width / ratio;
  return { left: 0, top: (containerH - height) / 2, width, height };
}

const MASK_ALPHA_CACHE = new Map<string, string>();
export function converterMascaraParaAlpha(maskUrl: string): Promise<string> {
  const cached = MASK_ALPHA_CACHE.get(maskUrl);
  if (cached) return Promise.resolve(cached);
  return new Promise(resolve => {
    try {
      const img = new Image();
      try { img.crossOrigin = 'anonymous'; } catch {}
      img.onload = () => {
        try {
          const w = Math.max(1, img.naturalWidth || 1);
          const h = Math.max(1, img.naturalHeight || 1);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { resolve(maskUrl); return; }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const id = ctx.getImageData(0, 0, w, h);
          for (let i = 0; i < id.data.length; i += 4) {
            const alpha = id.data[i + 3];
            const lum = (id.data[i] * 0.299 + id.data[i + 1] * 0.587 + id.data[i + 2] * 0.114);
            const a = alpha === 0 ? 0 : (lum > 18 ? Math.round((lum / 255) * alpha) : 0);
            id.data[i] = 255; id.data[i + 1] = 255; id.data[i + 2] = 255; id.data[i + 3] = a;
          }
          ctx.putImageData(id, 0, 0);
          const out = canvas.toDataURL('image/png');
          MASK_ALPHA_CACHE.set(maskUrl, out);
          resolve(out);
        } catch { resolve(maskUrl); }
      };
      img.onerror = () => resolve(maskUrl);
      img.src = maskUrl;
    } catch { resolve(maskUrl); }
  });
}
export function maskImageFromMask(mask?: MaskResult) {
  return mask?.guardBitmapDataUrl || mask?.bitmapDataUrl || undefined;
}
export function fotoPreviewVisualProps(produto?: Produto, mockup?: { modoGravacaoPadrao?: string; cor?: string }, transform?: { brilho?: number; contraste?: number }) {
  const cor = String(produto?.cor || '').toLowerCase();
  const brilho = Number(transform?.brilho || 100) / 100;
  const contraste = Number(transform?.contraste || 110) / 100;
  const modo = mockup?.modoGravacaoPadrao || (cor === 'preta' || cor === 'preto' ? 'remocao_tinta_preta' : 'escurecido_pb');
  if (modo === 'remocao_tinta_preta') {
    return { filter: `grayscale(1) brightness(${Math.max(1.3, brilho)}) contrast(${Math.max(1.2, contraste)})`, opacity: 0.96, mixBlendMode: 'screen' as const };
  }
  if (cor === 'dourada' || cor === 'dourado') {
    return { filter: `grayscale(1) sepia(.18) brightness(${brilho}) contrast(${contraste + 0.05})`, opacity: 0.78, mixBlendMode: 'multiply' as const };
  }
  return { filter: `grayscale(1) brightness(${brilho}) contrast(${contraste + 0.1})`, opacity: 0.78, mixBlendMode: 'multiply' as const };
}

// --- Gerador de QR Code (versões 1-9, correção de erro nível L) --------------------------------
// Porta fiel do algoritmo já usado e testado no editor desktop (ProjetosV3Page.tsx) -- é
// bit-a-bit sensível (Reed-Solomon, máscara, posicionamento de padrões), então mantido igual em
// vez de reescrito.
const QR_LOW = [
  null,
  { data: 19, ecc: 7, blocks: [19], align: [] },
  { data: 34, ecc: 10, blocks: [34], align: [6, 18] },
  { data: 55, ecc: 15, blocks: [55], align: [6, 22] },
  { data: 80, ecc: 20, blocks: [80], align: [6, 26] },
  { data: 108, ecc: 26, blocks: [108], align: [6, 30] },
  { data: 136, ecc: 18, blocks: [68, 68], align: [6, 34] },
  { data: 156, ecc: 20, blocks: [78, 78], align: [6, 22, 38] },
  { data: 194, ecc: 24, blocks: [97, 97], align: [6, 24, 42] },
  { data: 232, ecc: 30, blocks: [116, 116], align: [6, 26, 46] },
] as const;
function qrByteLen(version: number, bytes: number) { return 4 + (version <= 9 ? 8 : 16) + bytes * 8; }
function qrGfMul(x: number, y: number) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
function qrRsDivisor(degree: number) { const result = Array(degree).fill(0); result[degree - 1] = 1; let root = 1; for (let i = 0; i < degree; i++) { for (let j = 0; j < result.length; j++) { result[j] = qrGfMul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; } root = qrGfMul(root, 2); } return result; }
function qrRsRemainder(data: number[], divisor: number[]) { const result = Array(divisor.length).fill(0); for (const b of data) { const factor = b ^ (result.shift() as number); result.push(0); divisor.forEach((coef, i) => { result[i] ^= qrGfMul(coef, factor); }); } return result; }
function qrAppendBits(out: number[], val: number, len: number) { for (let i = len - 1; i >= 0; i--) out.push((val >>> i) & 1); }
function qrBchRemainder(val: number, poly: number) { const msb = 31 - Math.clz32(poly); val <<= msb; while ((31 - Math.clz32(val)) >= msb) val ^= poly << ((31 - Math.clz32(val)) - msb); return val; }
function qrDrawFinder(mod: boolean[][], fun: boolean[][], x: number, y: number) { const size = mod.length; for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) { const xx = x + dx, yy = y + dy; if (0 <= xx && xx < size && 0 <= yy && yy < size) { const dark = (0 <= dx && dx <= 6 && 0 <= dy && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (2 <= dx && dx <= 4 && 2 <= dy && dy <= 4))); mod[yy][xx] = dark; fun[yy][xx] = true; } } }
function qrDrawAlignment(mod: boolean[][], fun: boolean[][], x: number, y: number) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; mod[yy][xx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1; fun[yy][xx] = true; } }
export function qrMake(value: string) {
  const dataBytes = Array.from(new TextEncoder().encode(value || 'https://terepersonalizados.com.br'));
  let version = 1;
  for (; version < QR_LOW.length; version++) { const spec = QR_LOW[version]!; if (qrByteLen(version, dataBytes.length) <= spec.data * 8) break; }
  if (version >= QR_LOW.length) throw new Error('Link muito longo para o QR interno');
  const spec = QR_LOW[version]!; const size = 21 + (version - 1) * 4;
  const mod = Array.from({ length: size }, () => Array(size).fill(false)); const fun = Array.from({ length: size }, () => Array(size).fill(false));
  qrDrawFinder(mod, fun, 0, 0); qrDrawFinder(mod, fun, size - 7, 0); qrDrawFinder(mod, fun, 0, size - 7);
  for (let i = 0; i < size; i++) { if (!fun[6][i]) { mod[6][i] = i % 2 === 0; fun[6][i] = true; } if (!fun[i][6]) { mod[i][6] = i % 2 === 0; fun[i][6] = true; } }
  for (const ax of spec.align) for (const ay of spec.align) { if (fun[ay][ax]) continue; qrDrawAlignment(mod, fun, ax, ay); }
  mod[4 * version + 9][8] = true; fun[4 * version + 9][8] = true;
  const formatA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const formatB = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [size - 8, 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
  [...formatA, ...formatB].forEach(([x, y]) => { fun[y][x] = true; });
  const bits: number[] = []; qrAppendBits(bits, 0b0100, 4); qrAppendBits(bits, dataBytes.length, version <= 9 ? 8 : 16); dataBytes.forEach(b => qrAppendBits(bits, b, 8));
  const capacityBits = spec.data * 8; qrAppendBits(bits, 0, Math.min(4, capacityBits - bits.length)); while (bits.length % 8) bits.push(0);
  const dataCodewords: number[] = []; for (let i = 0; i < bits.length; i += 8) dataCodewords.push(parseInt(bits.slice(i, i + 8).join(''), 2)); for (let pad = 0xEC; dataCodewords.length < spec.data; pad ^= 0xEC ^ 0x11) dataCodewords.push(pad);
  const divisor = qrRsDivisor(spec.ecc); const blocks: number[][] = []; const eccs: number[][] = []; let pos = 0;
  for (const len of spec.blocks) { const b = dataCodewords.slice(pos, pos + len); pos += len; blocks.push(b); eccs.push(qrRsRemainder(b, divisor)); }
  const allCodewords: number[] = []; const maxData = Math.max(...blocks.map(b => b.length)); for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) allCodewords.push(b[i]); for (let i = 0; i < spec.ecc; i++) for (const e of eccs) allCodewords.push(e[i]);
  const allBits: number[] = []; allCodewords.forEach(b => qrAppendBits(allBits, b, 8));
  let bitIndex = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right--; for (let vert = 0; vert < size; vert++) { const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert; for (let j = 0; j < 2; j++) { const x = right - j; if (fun[y][x]) continue; const bit = bitIndex < allBits.length ? allBits[bitIndex++] === 1 : false; const mask = (x + y) % 2 === 0; mod[y][x] = bit !== mask; } } }
  const fmt = ((0b01 << 3) | 0); const rem = qrBchRemainder(fmt, 0x537); const bits15 = ((fmt << 10) | rem) ^ 0x5412;
  for (let i = 0; i < 15; i++) { const bit = ((bits15 >>> i) & 1) !== 0; const a = formatA[i]; const b = formatB[i]; mod[a[1]][a[0]] = bit; fun[a[1]][a[0]] = true; mod[b[1]][b[0]] = bit; fun[b[1]][b[0]] = true; }
  return mod;
}
