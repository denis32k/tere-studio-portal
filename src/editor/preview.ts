import type { PhotoTransform, Produto, ProductMockup, VersoElemento, VersoModoGravacao } from './types';
import { imagemMockupLado, mascaraMockupLado, corVersoModo } from './normalize';
import {
  createCanvas, loadImageElement, roundedRectPath, drawRoundedPanel, drawShapeClipBox,
  drawImageContainBox, fitImageBox, maskBoundsForPreview, drawQrModules, drawPreviewWatermark,
  converterMascaraParaAlpha, maskImageFromMask, fotoPreviewVisualProps, aplicarEfeitoGravacaoPixels, qrMake, type PreviewWatermarkAsset,
} from './canvasHelpers';
import { elementoBox, fonteFamilia } from './VersoCanvas';
import { spotifyCodeFiltroProjeto } from './ui';

export type GerarPreviewInput = {
  produto: Produto;
  mockup?: ProductMockup;
  frenteImagem?: string;
  frenteTransform: PhotoTransform;
  mockupFrenteSize: number;
  versoElementos: VersoElemento[];
  versoModoGravacao: VersoModoGravacao;
  mockupVersoSize: number;
  watermarkAsset: PreviewWatermarkAsset;
  comMarcaDagua: boolean;
};

function slugArquivo(value?: string) {
  return String(value || 'previa').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'previa';
}

export async function gerarPreviewCanvas(input: GerarPreviewInput): Promise<HTMLCanvasElement> {
  const { produto, mockup, frenteImagem, frenteTransform, mockupFrenteSize, versoElementos, versoModoGravacao, mockupVersoSize, watermarkAsset, comMarcaDagua } = input;
  const panelWidth = 680;
  const pieceSquare = 600;
  const pieceX = Math.round((panelWidth - pieceSquare) / 2);
  const pieceY = 70;
  const labelY = 40;
  const panelHeight = pieceY + pieceSquare + 40;

  const footerBrandLogo = watermarkAsset.imageSrc ? await loadImageElement(watermarkAsset.imageSrc).catch(() => null) : null;
  const watermarkLogo = comMarcaDagua ? footerBrandLogo : null;
  const mockFrontSrc = imagemMockupLado(mockup, 'frente');
  const mockFrontImg = mockFrontSrc ? await loadImageElement(mockFrontSrc).catch(() => null) : null;
  const mockVersoSrc = imagemMockupLado(mockup, 'verso', false) || imagemMockupLado(mockup, 'frente');
  const mockVersoImg = mockVersoSrc ? await loadImageElement(mockVersoSrc).catch(() => null) : null;
  const frontPhotoImg = frenteImagem ? await loadImageElement(frenteImagem).catch(() => null) : null;
  const hasVerso = versoElementos.length > 0;
  const spotifyImages = new Map<string, HTMLImageElement | null>();
  await Promise.all(versoElementos.filter(el => el.tipo === 'spotify' && el.meta?.imagem).map(async el => {
    spotifyImages.set(el.id, await loadImageElement(el.meta!.imagem!).catch(() => null));
  }));

  const drawPieceBase = (ctx: CanvasRenderingContext2D, areaLabel: string) => {
    drawRoundedPanel(ctx, 14, 14, panelWidth - 28, panelHeight - 28, 28, '#FFFDF8');
    ctx.strokeStyle = 'rgba(200,169,110,.28)';
    ctx.lineWidth = 1;
    roundedRectPath(ctx, 14, 14, panelWidth - 28, panelHeight - 28, 28);
    ctx.stroke();
    ctx.fillStyle = '#6B5A32';
    ctx.font = '600 15px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(areaLabel.toUpperCase(), panelWidth / 2, labelY);
  };

  const drawTransformedFrontPhoto = (ctx: CanvasRenderingContext2D, target: { x: number; y: number; width: number; height: number }) => {
    if (!frontPhotoImg) return;
    const visual = fotoPreviewVisualProps(produto, mockup, frenteTransform);
    const editorSize = Math.max(1, mockupFrenteSize || 315);
    const moveScaleX = target.width / editorSize;
    const moveScaleY = target.height / editorSize;
    // Desenha num canvas à parte (mesmo tamanho da prévia inteira, pra não cortar nada quando a
    // foto está rotacionada) e aplica o efeito de gravação por pixel ali, não com ctx.filter --
    // depois só compõe no canvas principal com o blend mode. Motivo em GravacaoVisual/
    // aplicarEfeitoGravacaoPixels: ctx.filter não tem suporte em navegador mobile mais antigo, e
    // nesse caso a foto saía em cor normal na prévia final em vez de simular a gravação.
    const off = createCanvas(ctx.canvas.width, ctx.canvas.height);
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.translate(target.x + target.width / 2 + frenteTransform.x * moveScaleX, target.y + target.height / 2 + frenteTransform.y * moveScaleY);
    offCtx.rotate((frenteTransform.rotation || 0) * Math.PI / 180);
    offCtx.scale((frenteTransform.flipH ? -1 : 1) * frenteTransform.scale, frenteTransform.scale);
    // Mostra a foto inteira (contain) em vez de cortar o excesso (cover) -- combina com o editor
    // ao vivo, que também passou a mostrar a foto inteira por padrão em vez de forçar um corte
    // quadrado. Quem quiser preencher mais ainda pode dar zoom manualmente antes de gerar a prévia.
    const fit = fitImageBox(target.width, target.height, frontPhotoImg.naturalWidth || 1, frontPhotoImg.naturalHeight || 1);
    offCtx.drawImage(frontPhotoImg, -fit.width / 2, -fit.height / 2, fit.width, fit.height);
    aplicarEfeitoGravacaoPixels(offCtx, 0, 0, off.width, off.height, visual);
    ctx.save();
    ctx.globalAlpha = visual.opacity ?? 1;
    ctx.globalCompositeOperation = visual.mixBlendMode === 'screen' ? 'screen' : visual.mixBlendMode === 'multiply' ? 'multiply' : 'source-over';
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  };

  const renderFrontPanel = async () => {
    const canvas = createCanvas(panelWidth, panelHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não consegui preparar a prévia.');
    drawPieceBase(ctx, 'Frente');
    ctx.fillStyle = '#FFFDF8';
    roundedRectPath(ctx, pieceX - 10, pieceY - 10, pieceSquare + 20, pieceSquare + 20, 26);
    ctx.fill();
    const mockFrontBox = mockFrontImg
      ? drawImageContainBox(ctx, mockFrontImg, pieceX, pieceY, pieceSquare, pieceSquare, mockFrontImg.naturalWidth || 1, mockFrontImg.naturalHeight || 1)
      : { x: pieceX, y: pieceY, width: pieceSquare, height: pieceSquare };
    if (frontPhotoImg) {
      const frontMask = mascaraMockupLado(mockup, 'frente');
      const maskBounds = maskBoundsForPreview(frontMask, produto);
      const maskSrc = maskImageFromMask(frontMask);
      const temp = createCanvas(panelWidth, panelHeight);
      const tctx = temp.getContext('2d');
      if (tctx) {
        drawTransformedFrontPhoto(tctx, mockFrontBox);
        tctx.globalCompositeOperation = 'destination-in';
        if (maskSrc) {
          const alphaSrc = await converterMascaraParaAlpha(maskSrc).catch(() => maskSrc);
          const alphaImg = await loadImageElement(alphaSrc).catch(() => null);
          if (alphaImg) tctx.drawImage(alphaImg, mockFrontBox.x, mockFrontBox.y, mockFrontBox.width, mockFrontBox.height);
          else { drawShapeClipBox(tctx, maskBounds.xPct, maskBounds.yPct, maskBounds.wPct, maskBounds.hPct, maskBounds.shape, mockFrontBox); tctx.fillStyle = '#fff'; tctx.fill(); }
        } else {
          drawShapeClipBox(tctx, maskBounds.xPct, maskBounds.yPct, maskBounds.wPct, maskBounds.hPct, maskBounds.shape, mockFrontBox);
          tctx.fillStyle = '#fff';
          tctx.fill();
        }
        ctx.drawImage(temp, 0, 0);
      }
    }
    if (comMarcaDagua) drawPreviewWatermark(ctx, { x: pieceX - 10, y: pieceY - 10, width: pieceSquare + 20, height: pieceSquare + 20 }, watermarkAsset, watermarkLogo);
    return canvas;
  };

  const drawVersoElementOnCanvas = (ctx: CanvasRenderingContext2D, el: VersoElemento, target: { x: number; y: number; width: number; height: number }) => {
    const box = elementoBox(el);
    const editorSize = Math.max(1, mockupVersoSize || 315);
    const renderScale = Math.min(target.width, target.height) / editorSize;
    const cx = target.x + target.width / 2 + el.x * renderScale;
    const cy = target.y + target.height / 2 + el.y * renderScale;
    const engravingColor = corVersoModo(versoModoGravacao);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((el.rotacao || 0) * Math.PI / 180);
    ctx.scale((el.escala || 1) * renderScale, (el.escala || 1) * renderScale);
    ctx.fillStyle = engravingColor;
    ctx.strokeStyle = engravingColor;
    ctx.textAlign = el.align || 'center';
    ctx.textBaseline = 'middle';
    if (el.tipo === 'qrcode') {
      let modules: boolean[][];
      try { modules = qrMake(el.meta?.qrUrl || el.conteudo || 'https://terepersonalizados.com.br'); }
      catch { modules = qrMake('https://terepersonalizados.com.br'); }
      drawQrModules(ctx, modules, -29, -29, 58, engravingColor);
      ctx.restore();
      return;
    }
    if (el.tipo === 'spotify') {
      const spotifyImg = spotifyImages.get(el.id) || null;
      if (spotifyImg) {
        const filtroAnterior = ctx.filter;
        ctx.filter = spotifyCodeFiltroProjeto(engravingColor);
        ctx.drawImage(spotifyImg, -63, -15, 126, 30);
        ctx.filter = filtroAnterior;
      }
      ctx.restore();
      return;
    }
    if (el.tipo === 'simbolo') {
      ctx.font = '400 40px Georgia, serif';
      ctx.fillText(el.conteudo || '♥', 0, 0);
      ctx.restore();
      return;
    }
    const lines = String(el.conteudo || 'Texto').split(/\n/);
    const lineHeight = 20 * (el.lineHeight || 1.1);
    const fontSize = 19;
    ctx.font = `400 ${fontSize}px ${fonteFamilia(el.fonte)}`;
    lines.forEach((line, idx) => {
      const y = (idx - (lines.length - 1) / 2) * lineHeight;
      const x = (el.align || 'center') === 'left' ? -box.w / 2 : (el.align || 'center') === 'right' ? box.w / 2 : 0;
      ctx.fillText(line || ' ', x, y, box.w + 20);
    });
    ctx.restore();
  };

  const renderVersoPanel = async () => {
    const canvas = createCanvas(panelWidth, panelHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não consegui preparar a prévia.');
    drawPieceBase(ctx, 'Verso');
    ctx.fillStyle = '#FFFDF8';
    roundedRectPath(ctx, pieceX - 10, pieceY - 10, pieceSquare + 20, pieceSquare + 20, 26);
    ctx.fill();
    const mockVersoBox = mockVersoImg
      ? drawImageContainBox(ctx, mockVersoImg, pieceX, pieceY, pieceSquare, pieceSquare, mockVersoImg.naturalWidth || 1, mockVersoImg.naturalHeight || 1)
      : { x: pieceX, y: pieceY, width: pieceSquare, height: pieceSquare };
    const layers = createCanvas(panelWidth, panelHeight);
    const lctx = layers.getContext('2d');
    if (lctx) {
      versoElementos.forEach(el => drawVersoElementOnCanvas(lctx, el, mockVersoBox));
      lctx.globalCompositeOperation = 'destination-in';
      const versoMask = mascaraMockupLado(mockup, 'verso') || mascaraMockupLado(mockup, 'frente');
      const maskBounds = maskBoundsForPreview(versoMask, produto);
      const maskSrc = maskImageFromMask(versoMask);
      if (maskSrc) {
        const alphaSrc = await converterMascaraParaAlpha(maskSrc).catch(() => maskSrc);
        const alphaImg = await loadImageElement(alphaSrc).catch(() => null);
        if (alphaImg) lctx.drawImage(alphaImg, mockVersoBox.x, mockVersoBox.y, mockVersoBox.width, mockVersoBox.height);
        else { drawShapeClipBox(lctx, maskBounds.xPct, maskBounds.yPct, maskBounds.wPct, maskBounds.hPct, maskBounds.shape, mockVersoBox); lctx.fillStyle = '#fff'; lctx.fill(); }
      } else {
        drawShapeClipBox(lctx, maskBounds.xPct, maskBounds.yPct, maskBounds.wPct, maskBounds.hPct, maskBounds.shape, mockVersoBox);
        lctx.fillStyle = '#fff';
        lctx.fill();
      }
      ctx.drawImage(layers, 0, 0);
    }
    if (comMarcaDagua) drawPreviewWatermark(ctx, { x: pieceX - 10, y: pieceY - 10, width: pieceSquare + 20, height: pieceSquare + 20 }, watermarkAsset, watermarkLogo);
    return canvas;
  };

  const frontCanvas = await renderFrontPanel();
  const versoCanvas = hasVerso ? await renderVersoPanel() : null;

  const gap = 36;
  const sideMargin = 70;
  const topMargin = 54;
  const footerHeight = 100;
  const finalWidth = versoCanvas ? sideMargin * 2 + panelWidth * 2 + gap : sideMargin * 2 + panelWidth;
  const finalHeight = topMargin + panelHeight + footerHeight;
  const finalCanvas = createCanvas(finalWidth, finalHeight);
  const fctx = finalCanvas.getContext('2d');
  if (!fctx) throw new Error('Não consegui montar a prévia.');
  const bg = fctx.createRadialGradient(finalWidth / 2, -finalHeight * 0.15, finalWidth * 0.2, finalWidth / 2, finalHeight * 0.5, finalWidth * 0.9);
  bg.addColorStop(0, '#FBF7EE');
  bg.addColorStop(0.55, '#F3EAD6');
  bg.addColorStop(1, '#ECDFC0');
  fctx.fillStyle = bg;
  fctx.fillRect(0, 0, finalWidth, finalHeight);
  if (versoCanvas) {
    fctx.drawImage(frontCanvas, sideMargin, topMargin, panelWidth, panelHeight);
    fctx.drawImage(versoCanvas, finalWidth - panelWidth - sideMargin, topMargin, panelWidth, panelHeight);
  } else {
    fctx.drawImage(frontCanvas, (finalWidth - panelWidth) / 2, topMargin, panelWidth, panelHeight);
  }
  fctx.fillStyle = '#6B5A32';
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.font = '600 30px Inter, Arial, sans-serif';
  fctx.fillText(watermarkAsset.text || 'Terê Personalizados', finalWidth / 2, topMargin + panelHeight + footerHeight / 2);

  return finalCanvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
}

export function nomeArquivoPreview(produto: Produto, temVerso: boolean) {
  return `${slugArquivo(produto.nome)}-${temVerso ? 'frente-verso' : 'frente'}.png`;
}

export function podeCompartilharArquivo(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  return typeof nav.canShare === 'function' && typeof navigator.share === 'function' && nav.canShare({ files: [file] });
}

export async function compartilharOuBaixarPreview(canvas: HTMLCanvasElement, produto: Produto, temVerso: boolean): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error('Não consegui gerar a imagem da prévia.');
  const fileName = nomeArquivoPreview(produto, temVerso);
  const file = new File([blob], fileName, { type: 'image/png' });

  if (podeCompartilharArquivo(file)) {
    try {
      await navigator.share({ files: [file], title: 'Prévia Terê Studio', text: `Prévia: ${produto.nome}` });
      return 'compartilhado';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelado';
      // Falhou por outro motivo (ex: navegador reporta suporte mas recusa em runtime) -- cai pro download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return 'baixado';
}
