import { getToken } from '../lib/api';
import { portalSpotifyResolve } from '../lib/api';

export type SpotifyCodeResolved = {
  title: string;
  artist: string;
  spotifyUrl: string;
  imageDataUrl: string;
};

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não consegui carregar a imagem do Spotify Code.'));
    img.src = src;
  });
}

function mediaCantos(data: Uint8ClampedArray, width: number, height: number) {
  if (!width || !height) return 255;
  const pontos = [[0, 0], [Math.max(0, width - 1), 0], [0, Math.max(0, height - 1)], [Math.max(0, width - 1), Math.max(0, height - 1)]];
  let soma = 0;
  let total = 0;
  pontos.forEach(([x, y]) => {
    const idx = (y * width + x) * 4;
    const a = data[idx + 3];
    if (!a) return;
    soma += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    total += 1;
  });
  return total ? soma / total : 255;
}

async function converterSpotifyBlobParaPretoTransparente(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageEl(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 640;
    canvas.height = img.naturalHeight || img.height || 180;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Não consegui preparar a imagem do Spotify Code.');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const fundoEscuro = mediaCantos(data, canvas.width, canvas.height) < 128;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (!a) continue;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contraste = fundoEscuro ? lum : 255 - lum;
      if (contraste <= 10) { data[i + 3] = 0; continue; }
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      data[i + 3] = Math.max(a, Math.min(255, Math.round(contraste * 1.35)));
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function gerarSpotifyCodePortal(link: string): Promise<SpotifyCodeResolved> {
  const resolved = await portalSpotifyResolve(link);
  const imageResp = await fetch(resolved.imageProxyUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!imageResp.ok) throw new Error('Não consegui baixar a imagem do Spotify Code.');
  const imageDataUrl = await converterSpotifyBlobParaPretoTransparente(await imageResp.blob());
  return {
    title: resolved.item.title || 'Spotify Code',
    artist: resolved.item.artist || '',
    spotifyUrl: resolved.item.url || link,
    imageDataUrl,
  };
}
