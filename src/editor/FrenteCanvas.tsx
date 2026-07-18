import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCcw, Trash2 } from 'lucide-react';
import { clamp, type PaintStroke, type PhotoTransform, type Produto, type ProductMockup } from './types';
import { imagemMockupLado, mascaraMockupLado } from './normalize';
import { fotoPreviewVisualProps, bakeGravacaoNaFoto } from './canvasHelpers';
import { ProdutoFallback } from './ui';

export function FrenteCanvas({ produto, mockup, photoUrl, transform, retouchStrokes = [], retouchMode = null, brushSizePct = 4, onRetouchStroke, onCancelRetouch, onTransformChange, selected, onSelect, onRemove, size = 310 }: {
  produto?: Produto; mockup?: ProductMockup; photoUrl?: string; transform: PhotoTransform;
  retouchStrokes?: PaintStroke[]; retouchMode?: 'erase' | 'add' | null; brushSizePct?: number;
  onRetouchStroke?: (stroke: PaintStroke) => void; onCancelRetouch?: () => void;
  onTransformChange: React.Dispatch<React.SetStateAction<PhotoTransform>>;
  selected: boolean; onSelect: () => void; onRemove: () => void; size?: number;
}) {
  const h = Math.round(size * 1.15);
  const frontMask = mascaraMockupLado(mockup, 'frente');
  const img = imagemMockupLado(mockup, 'frente');
  const action = useRef<{ mode: 'drag' | 'scale' | 'rotate'; startX: number; startY: number; start: PhotoTransform } | null>(null);
  const rafTransform = useRef<number | null>(null);
  const pendingTransform = useRef<PhotoTransform | null>(null);
  // Pinça com 2 dedos pra dar zoom -- os botões de girar/tamanho já cobriam 1 dedo, mas
  // pinça é o gesto que todo mundo tenta primeiro num app de foto.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ distance: number; start: PhotoTransform } | null>(null);
  const maskId = useRef(`portalFrontMask_${Math.random().toString(36).slice(2)}`).current;
  const canvasSize = size;
  const [brushPreview, setBrushPreview] = useState<{ canvasX: number; canvasY: number; imageX: number; imageY: number } | null>(null);

  // A cor/gravação da foto vem "assada" nos pixels, não de CSS filter -- ctx.filter e depois
  // filter+mask no mesmo elemento SVG já se mostraram ignorados em navegador mobile real (duas
  // tentativas anteriores, confirmadas pelo lojista testando em iPhone de verdade). Assar direto
  // no arquivo elimina de vez a dependência do navegador aplicar o filtro CSS certo.
  const [bakedPhotoUrl, setBakedPhotoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!photoUrl) { setBakedPhotoUrl(undefined); return; }
    let ativo = true;
    bakeGravacaoNaFoto(photoUrl, produto, mockup, transform).then(url => { if (ativo) setBakedPhotoUrl(url); }).catch(() => { if (ativo) setBakedPhotoUrl(undefined); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, produto?.cor, mockup?.modoGravacaoPadrao, transform.brilho, transform.contraste]);
  const photoUrlExibido = bakedPhotoUrl || photoUrl;

  useEffect(() => {
    const flushTransform = () => {
      if (rafTransform.current != null) { window.cancelAnimationFrame(rafTransform.current); rafTransform.current = null; }
      const next = pendingTransform.current;
      pendingTransform.current = null;
      if (next) onTransformChange(next);
    };
    const emitTransform = (next: PhotoTransform) => {
      pendingTransform.current = next;
      if (rafTransform.current != null) return;
      rafTransform.current = window.requestAnimationFrame(() => {
        rafTransform.current = null;
        const current = pendingTransform.current;
        pendingTransform.current = null;
        if (current) onTransformChange(current);
      });
    };
    const move = (ev: PointerEvent) => {
      if (activePointers.current.has(ev.pointerId)) activePointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinchStart.current && activePointers.current.size === 2) {
        const [p1, p2] = Array.from(activePointers.current.values());
        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const ratio = distance / Math.max(1, pinchStart.current.distance);
        emitTransform({ ...pinchStart.current.start, scale: clamp(pinchStart.current.start.scale * ratio, 0.25, 5) });
        return;
      }
      const a = action.current;
      if (!a) return;
      const dx = ev.clientX - a.startX;
      const dy = ev.clientY - a.startY;
      if (a.mode === 'drag') emitTransform({ ...a.start, x: a.start.x + dx, y: a.start.y + dy });
      if (a.mode === 'scale') emitTransform({ ...a.start, scale: clamp(a.start.scale + (dx + dy) / 190, 0.25, 5) });
      if (a.mode === 'rotate') emitTransform({ ...a.start, rotation: Math.round(a.start.rotation + dx * 0.75) });
    };
    const up = (ev: PointerEvent) => {
      activePointers.current.delete(ev.pointerId);
      if (activePointers.current.size < 2) pinchStart.current = null;
      flushTransform();
      action.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      flushTransform();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [onTransformChange]);

  const pointerToRetouchPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const canvasX = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const canvasY = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    const dxPct = (transform.x / Math.max(1, canvasSize)) * 100;
    const dyPct = (transform.y / Math.max(1, canvasSize)) * 100;
    const translatedX = canvasX - (50 + dxPct);
    const translatedY = canvasY - (50 + dyPct);
    const rad = -(transform.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;
    const sx = transform.flipH ? -Math.max(0.001, transform.scale) : Math.max(0.001, transform.scale);
    const sy = Math.max(0.001, transform.scale);
    return { canvasX, canvasY, imageX: clamp(rotatedX / sx + 50, -20, 120), imageY: clamp(rotatedY / sy + 50, -20, 120) };
  };

  const addRetouchStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!photoUrl || !retouchMode || !onRetouchStroke) return;
    const point = pointerToRetouchPoint(e);
    if (!point) return;
    setBrushPreview(point);
    onRetouchStroke({ xPct: point.imageX, yPct: point.imageY, sizePct: brushSizePct, mode: retouchMode === 'add' ? 'add' : 'erase', space: 'image' });
  };
  const updateBrushPreview = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!photoUrl || !retouchMode) return;
    const point = pointerToRetouchPoint(e);
    if (point) setBrushPreview(point);
  };
  const startAction = (mode: 'drag' | 'scale' | 'rotate', e: React.PointerEvent) => {
    if (!photoUrl) return;
    e.preventDefault(); e.stopPropagation(); onSelect();
    if (mode === 'drag') {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.current.size >= 2) {
        const [p1, p2] = Array.from(activePointers.current.values()).slice(0, 2);
        pinchStart.current = { distance: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)), start: { ...transform } };
        action.current = null;
        return;
      }
    }
    action.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...transform } };
  };

  const dx = (transform.x / Math.max(1, canvasSize)) * 100;
  const dy = (transform.y / Math.max(1, canvasSize)) * 100;
  const svgT = [`translate(${50 + dx} ${50 + dy})`, `rotate(${transform.rotation})`, `scale(${transform.flipH ? -transform.scale : transform.scale} ${transform.scale})`, `translate(-50 -50)`].join(' ');

  const mask = frontMask;
  const b = mask?.bounds || { xPct: 27, yPct: 34, wPct: 46, hPct: 46 };
  const shape = () => {
    if (mask?.shape === 'circle') { const r = Math.min(b.wPct, b.hPct) / 2; return <circle cx={b.xPct + b.wPct / 2} cy={b.yPct + b.hPct / 2} r={r} fill="white" />; }
    if (mask?.shape === 'ellipse') return <ellipse cx={b.xPct + b.wPct / 2} cy={b.yPct + b.hPct / 2} rx={b.wPct / 2} ry={b.hPct / 2} fill="white" />;
    return <rect x={b.xPct} y={b.yPct} width={b.wPct} height={b.hPct} rx={1.4} fill="white" />;
  };
  const basePaintStrokes = mask?.paintStrokes || [];
  const basePaintStrokeNodes = basePaintStrokes.map((s, i) => <circle key={`base-paint-${i}-${s.mode}`} cx={s.xPct} cy={s.yPct} r={s.sizePct / 2} fill={s.mode === 'add' ? 'white' : 'black'} />);
  const imageRetouchNodes = retouchStrokes.map((s, i) => <circle key={`image-retouch-${i}-${s.mode}`} cx={s.xPct} cy={s.yPct} r={s.sizePct / 2} fill={s.mode === 'add' ? 'white' : 'black'} />);
  const maskContent = mask?.guardBitmapDataUrl || mask?.bitmapDataUrl ? (
    <><image href={mask.guardBitmapDataUrl || mask.bitmapDataUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />{basePaintStrokeNodes}</>
  ) : (
    <>{!mask?.paintOnly && shape()}{basePaintStrokeNodes}</>
  );

  const gravacaoVisual = fotoPreviewVisualProps(produto, mockup, transform);
  // Sem filter aqui -- a cor já vem assada em photoUrlExibido (ver useEffect acima). Só opacity e
  // mix-blend-mode continuam via CSS, que dependem de como a foto se compõe com o mockup por baixo.
  const photoSvgStyle: React.CSSProperties = { opacity: gravacaoVisual.opacity, mixBlendMode: gravacaoVisual.mixBlendMode };
  const area = {
    w: canvasSize * (b.wPct / 100), h: canvasSize * (b.hPct / 100),
    left: canvasSize * ((b.xPct + b.wPct / 2) / 100), top: canvasSize * ((b.yPct + b.hPct / 2) / 100),
  };

  return (
    <div data-frente-retouch-safe="true" className="h-full min-h-0 flex items-center justify-center" onClick={(e) => { if (retouchMode && e.target === e.currentTarget) { onCancelRetouch?.(); setBrushPreview(null); return; } onSelect(); }} style={{ touchAction: 'none' }}>
      <div className="relative select-none" style={{ width: size, height: h }} onWheel={e => { if (!photoUrl) return; e.preventDefault(); onTransformChange(t => ({ ...t, scale: clamp(t.scale * (e.deltaY < 0 ? 1.08 : 0.93), 0.25, 5) })); }}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: canvasSize, height: canvasSize }}>
          {img ? <img src={img} className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" draggable={false} /> : <div className="absolute inset-0 flex items-center justify-center"><ProdutoFallback tipo={produto?.tipo} cor={produto?.cor} size={canvasSize} /></div>}
          {img && frontMask && photoUrl ? (
            <svg className={`absolute inset-0 w-full h-full select-none ${retouchMode ? 'cursor-none' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" onPointerDown={e => { if (retouchMode) { e.preventDefault(); e.stopPropagation(); onSelect(); addRetouchStroke(e); } else startAction('drag', e); }} onPointerMove={e => { if (retouchMode) { e.preventDefault(); e.stopPropagation(); if (e.buttons === 1) addRetouchStroke(e); else updateBrushPreview(e); } }} onPointerLeave={() => setBrushPreview(null)}>
              <defs>
                <mask id={maskId}><rect x="0" y="0" width="100" height="100" fill="black" />{maskContent}</mask>
                <mask id={`${maskId}_imageRetouch`} maskUnits="userSpaceOnUse" x="-30" y="-30" width="160" height="160">
                  <rect x="-30" y="-30" width="160" height="160" fill="white" />{imageRetouchNodes}
                </mask>
              </defs>
              {/* O filtro (grayscale/sépia) fica no <g> do transform, não no <image> -- esse
                  <image> já carrega sua própria mask (retoque manual), e filter+mask no MESMO
                  elemento SVG é uma combinação com histórico de bugs no Safari/WebKit (o
                  navegador às vezes ignora o filtro nesse caso, a foto sai sem o efeito de
                  gravação). Separar em elementos diferentes evita essa combinação. */}
              <g mask={`url(#${maskId})`}><g transform={svgT} style={photoSvgStyle}><image href={photoUrlExibido} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" mask={`url(#${maskId}_imageRetouch)`} /></g></g>
              {retouchMode && brushPreview && <circle cx={brushPreview.canvasX} cy={brushPreview.canvasY} r={(brushSizePct / 2) * transform.scale} fill={retouchMode === 'erase' ? 'rgba(239,68,68,.18)' : 'rgba(34,197,94,.16)'} stroke={retouchMode === 'erase' ? '#EF4444' : '#22C55E'} strokeWidth="0.6" strokeDasharray="1 1" pointerEvents="none" />}
            </svg>
          ) : !img || !frontMask ? (
            <div className="absolute overflow-hidden" style={{ width: area.w, height: area.h, left: area.left, top: area.top, transform: 'translate(-50%, -50%)', clipPath: 'circle(48% at 50% 50%)' }} onPointerDown={e => startAction('drag', e)}>
              {photoUrl ? <img src={photoUrlExibido} draggable={false} className="pointer-events-none select-none" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.flipH ? -transform.scale : transform.scale}, ${transform.scale})`, opacity: gravacaoVisual.opacity, mixBlendMode: gravacaoVisual.mixBlendMode, transformOrigin: 'center' }} /> : null}
            </div>
          ) : null}
          {photoUrl && selected && (
            <div className="absolute pointer-events-none" style={{ width: area.w, height: area.h, left: area.left, top: area.top, transform: 'translate(-50%, -50%)' }}>
              <div className="absolute inset-0 border border-[#C8A96E] rounded-md shadow-[0_0_0_1px_rgba(255,255,255,.72)]" />
              <button type="button" title="Girar" onPointerDown={e => startAction('rotate', e)} className="pointer-events-auto absolute left-1/2 -top-10 -translate-x-1/2 w-9 h-9 rounded-full border border-[#C8A96E] bg-white text-[#8A6F35] flex items-center justify-center shadow-sm"><RotateCcw size={15} /></button>
              <button type="button" title="Tamanho" onPointerDown={e => startAction('scale', e)} className="pointer-events-auto absolute -right-4 -bottom-4 w-9 h-9 rounded-full border border-[#C8A96E] bg-white text-[#8A6F35] flex items-center justify-center shadow-sm"><Maximize2 size={15} /></button>
              <button type="button" title="Remover foto" onClick={e => { e.stopPropagation(); onRemove(); }} className="pointer-events-auto absolute -right-4 -top-4 w-9 h-9 rounded-full border border-red-200 bg-white text-red-600 flex items-center justify-center shadow-sm"><Trash2 size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
