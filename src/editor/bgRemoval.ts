// Remoção de fundo client-side, rodando 100% no navegador via WASM (onnxruntime-web).
// Usa o MESMO modelo isnet-general-use (~170MB) do app desktop, com o mesmo pré/pós-processamento
// numérico do rembg (ver dis_general_use.py + sessions/base.py) para dar o mesmo resultado visual.
import * as ort from 'onnxruntime-web/wasm';

// Passa dos 100MB do limite de arquivo do GitHub -- hospedado à parte (mesmo esquema do
// ia-local.zip do desktop), não dentro do próprio deploy do portal.
const MODEL_URL = String(import.meta.env.VITE_BG_MODEL_URL || 'https://downloads.terepersonalizados.com.br/ia/isnet-general-use.onnx');
const MODEL_CACHE_NAME = 'tere-bg-model-v1';
const MODEL_INPUT_SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];

let ortConfigurePromise: Promise<void> | null = null;
// onnxruntime-web importa o .mjs do runtime via import() dinâmico. Nesse import direto pela URL
// http real, o navegador falha com "Failed to fetch dynamically imported module" mesmo com o
// arquivo servido certinho (200, content-type certo) -- só funciona importando de uma blob: URL
// com o mesmo conteúdo. Então busca o .mjs à mão e troca a URL real por uma blob: local.
function ensureOrtConfigured(): Promise<void> {
  if (!ortConfigurePromise) {
    ortConfigurePromise = (async () => {
      const base = `${window.location.origin}/ort/`;
      const mjsResp = await fetch(`${base}ort-wasm-simd-threaded.mjs`);
      if (!mjsResp.ok) throw new Error('Não consegui preparar o runtime de remoção de fundo.');
      const mjsBlob = await mjsResp.blob();
      const mjsBlobUrl = URL.createObjectURL(new Blob([mjsBlob], { type: 'text/javascript' }));
      ort.env.wasm.wasmPaths = {
        mjs: mjsBlobUrl,
        wasm: `${base}ort-wasm-simd-threaded.wasm`,
      };
      // Sem cross-origin isolation (COOP/COEP) o navegador não libera SharedArrayBuffer -- forçar
      // 1 thread evita depender desses headers (que quebrariam outras chamadas cross-origin do
      // app, como a imagem do Spotify Code) e ainda assim funciona no mesmo binário wasm.
      ort.env.wasm.numThreads = 1;
    })().catch(err => { ortConfigurePromise = null; throw err; });
  }
  return ortConfigurePromise;
}

export type BgRemovalProgress = { loaded: number; total: number; pct: number };

async function abrirCacheModelo(): Promise<Cache | null> {
  try { return await caches.open(MODEL_CACHE_NAME); } catch { return null; }
}

export async function modeloRemoverFundoJaBaixado(): Promise<boolean> {
  const cache = await abrirCacheModelo();
  if (!cache) return false;
  const hit = await cache.match(MODEL_URL);
  return Boolean(hit);
}

async function baixarModeloComProgresso(onProgress?: (p: BgRemovalProgress) => void): Promise<Response> {
  const cache = await abrirCacheModelo();
  const cached = cache ? await cache.match(MODEL_URL) : undefined;
  if (cached) return cached;

  const resp = await fetch(MODEL_URL);
  if (!resp.ok || !resp.body) throw new Error('Não consegui baixar o modelo de remoção de fundo.');
  const total = Number(resp.headers.get('content-length') || 0);
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      if (onProgress) onProgress({ loaded, total, pct: total ? Math.min(99, Math.round((loaded / total) * 100)) : 0 });
    }
  }
  const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' });
  const completa = new Response(blob, { headers: resp.headers });
  if (cache) {
    try { await cache.put(MODEL_URL, completa.clone()); } catch { /* sem espaço/quota -- segue só na memória */ }
  }
  if (onProgress) onProgress({ loaded, total: total || loaded, pct: 100 });
  return completa;
}

let sessaoPromise: Promise<ort.InferenceSession> | null = null;
export function getSessaoRemoverFundo(onProgress?: (p: BgRemovalProgress) => void): Promise<ort.InferenceSession> {
  if (!sessaoPromise) {
    sessaoPromise = (async () => {
      const [, resp] = await Promise.all([ensureOrtConfigured(), baixarModeloComProgresso(onProgress)]);
      const buffer = await resp.arrayBuffer();
      return ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] });
    })().catch(err => { sessaoPromise = null; throw err; });
  }
  return sessaoPromise;
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não consegui abrir essa foto.'));
    img.src = src;
  });
}

// Réplica de BaseSession.normalize (rembg): resize 1024x1024, RGB, /max(array), (px-mean)/std com
// std=(1,1,1), depois HWC -> CHW com batch dimension. Mantém os mesmos números do desktop.
function construirTensorEntrada(img: HTMLImageElement): ort.Tensor {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste navegador.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > max) max = data[i];
    if (data[i + 1] > max) max = data[i + 1];
    if (data[i + 2] > max) max = data[i + 2];
  }
  if (max <= 0) max = 255;

  const plano = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const tensorData = new Float32Array(plano * 3);
  for (let p = 0; p < plano; p++) {
    const o = p * 4;
    tensorData[p] = (data[o] / max) - MEAN[0];
    tensorData[plano + p] = (data[o + 1] / max) - MEAN[1];
    tensorData[plano * 2 + p] = (data[o + 2] / max) - MEAN[2];
  }
  return new ort.Tensor('float32', tensorData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
}

// Réplica de DisSession.predict: pega o canal 0 da saída, normaliza min-max pra 0..255.
function mascaraDaSaida(saida: ort.Tensor): { mask: Uint8ClampedArray; w: number; h: number } {
  const [, , h, w] = saida.dims as unknown as [number, number, number, number];
  const dataArr = saida.data as Float32Array;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < dataArr.length; i++) {
    if (dataArr[i] < min) min = dataArr[i];
    if (dataArr[i] > max) max = dataArr[i];
  }
  const amplitude = max - min || 1;
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(((dataArr[i] - min) / amplitude) * 255);
  return { mask, w, h };
}

export type RemoverFundoResultado = { dataUrl: string; usouGpu: false };

export async function removerFundoClientSide(imagemSrc: string, onProgress?: (p: BgRemovalProgress) => void): Promise<string> {
  const [session, img] = await Promise.all([getSessaoRemoverFundo(onProgress), carregarImagem(imagemSrc)]);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const tensor = construirTensorEntrada(img);
  const resultado = await session.run({ [inputName]: tensor });
  const { mask, w, h } = mascaraDaSaida(resultado[outputName]);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) throw new Error('Canvas indisponível neste navegador.');
  const maskImageData = maskCtx.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    maskImageData.data[o] = 0; maskImageData.data[o + 1] = 0; maskImageData.data[o + 2] = 0;
    maskImageData.data[o + 3] = mask[i];
  }
  maskCtx.putImageData(maskImageData, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = img.naturalWidth;
  outCanvas.height = img.naturalHeight;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas indisponível neste navegador.');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
  outCtx.globalCompositeOperation = 'destination-in';
  outCtx.drawImage(maskCanvas, 0, 0, outCanvas.width, outCanvas.height);
  outCtx.globalCompositeOperation = 'source-over';

  return outCanvas.toDataURL('image/png');
}
