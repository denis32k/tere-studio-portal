import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCcw, Trash2 } from 'lucide-react';
import { clamp, type Produto, type ProductMockup, type VersoElemento, type VersoModoGravacao } from './types';
import { imagemMockupLado, corVersoModo } from './normalize';
import { QRCodePreview, ProdutoFallback, SpotifyCodeVisual } from './ui';

export function fonteFamilia(nome?: string) {
  const idx = Math.min(9, Math.max(1, Number(String(nome || '').match(/\d+/)?.[0] || 1)));
  return `TereLetra${idx}, Cormorant Garamond, Georgia, serif`;
}
export function elementoBox(el: VersoElemento) {
  if (el.tipo === 'qrcode') return { w: 58, h: 58 };
  if (el.tipo === 'spotify') return { w: 126, h: 30 };
  if (el.tipo === 'simbolo') return { w: 46, h: 46 };
  const lines = String(el.conteudo || 'Texto').split(/\n/);
  const maxLen = Math.max(4, ...lines.map(l => l.length));
  // Achado ao vivo em 20/07/2026: 8px/linha 20px assumiam a fonte antiga (~16px, sem fontSize
  // explícito) -- com fontSize:28 a caixa calculada ficava estreita demais pro texto de verdade,
  // e ele quebrava linha sozinho mesmo cabendo perfeitamente numa linha só. Recalibrado pro
  // tamanho de fonte atual.
  return { w: clamp(maxLen * 15 + 24, 70, 260), h: clamp(lines.length * 32 * (el.lineHeight || 1.1) + 10, 40, 200) };
}

export function VersoCanvas({ produto, mockup, elementos, selectedId, onSelect, onChange, modoGravacao = 'preta', size = 310 }: {
  produto?: Produto; mockup?: ProductMockup; elementos: VersoElemento[]; selectedId: string | null;
  onSelect: (id: string | null) => void; onChange: (els: VersoElemento[]) => void; modoGravacao?: VersoModoGravacao; size?: number;
}) {
  const h = Math.round(size * 1.15);
  const drag = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const action = useRef<{ id: string; startX: number; startY: number; escala: number; rotacao: number; mode: 'scale' | 'rotate' } | null>(null);
  const rafElementos = useRef<number | null>(null);
  const pendingElementos = useRef<VersoElemento[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Pinça com 2 dedos pra dar zoom no elemento selecionado (mesmo gesto do FrenteCanvas).
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ id: string; distance: number; startEscala: number } | null>(null);

  const emitElementos = (next: VersoElemento[]) => {
    pendingElementos.current = next;
    if (rafElementos.current != null) return;
    rafElementos.current = window.requestAnimationFrame(() => {
      rafElementos.current = null;
      const current = pendingElementos.current;
      pendingElementos.current = null;
      if (current) onChange(current);
    });
  };
  const flushElementos = () => {
    if (rafElementos.current != null) { window.cancelAnimationFrame(rafElementos.current); rafElementos.current = null; }
    const current = pendingElementos.current;
    pendingElementos.current = null;
    if (current) onChange(current);
  };
  const updateEl = (id: string, patch: Partial<VersoElemento>) => onChange(elementos.map(e => e.id === id ? { ...e, ...patch } : e));
  const updateElPreview = (id: string, patch: Partial<VersoElemento>) => emitElementos(elementos.map(e => e.id === id ? { ...e, ...patch } : e));
  const removeEl = (id: string) => { onChange(elementos.filter(e => e.id !== id)); onSelect(null); };

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (activePointers.current.has(ev.pointerId)) activePointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinchStart.current && activePointers.current.size === 2) {
        const [p1, p2] = Array.from(activePointers.current.values());
        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const ratio = distance / Math.max(1, pinchStart.current.distance);
        updateElPreview(pinchStart.current.id, { escala: clamp(pinchStart.current.startEscala * ratio, 0.2, 6) });
        return;
      }
      if (drag.current) { const el = elementos.find(e => e.id === drag.current?.id); const d = drag.current; if (!el || !d) return; updateElPreview(el.id, { x: d.baseX + (ev.clientX - d.startX), y: d.baseY + (ev.clientY - d.startY) }); return; }
      const a = action.current; if (!a) return; const el = elementos.find(e => e.id === a.id); if (!el) return;
      if (a.mode === 'scale') updateElPreview(a.id, { escala: clamp(a.escala + (ev.clientX - a.startX + ev.clientY - a.startY) / 180, 0.2, 6) });
      else updateElPreview(a.id, { rotacao: Math.round(a.rotacao + (ev.clientX - a.startX) * 0.7) });
    };
    const up = (ev: PointerEvent) => {
      activePointers.current.delete(ev.pointerId);
      if (activePointers.current.size < 2) pinchStart.current = null;
      flushElementos(); drag.current = null; action.current = null;
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { flushElementos(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementos, onChange]);

  const imgVersoReal = imagemMockupLado(mockup, 'verso', false);
  const imgVerso = imgVersoReal || imagemMockupLado(mockup, 'frente');
  const engravingColor = corVersoModo(modoGravacao);

  const renderConteudo = (el: VersoElemento) => {
    if (editingId === el.id && el.tipo === 'texto') {
      return <textarea autoFocus value={el.conteudo} onChange={e => updateEl(el.id, { conteudo: e.target.value })} onBlur={() => setEditingId(null)} className="bg-white/95 border border-[#C8A96E] rounded px-2 py-1 text-sm outline-none resize-none" style={{ width: elementoBox(el).w + 24, minHeight: 42, fontFamily: fonteFamilia(el.fonte), lineHeight: el.lineHeight || 1.1, letterSpacing: `${el.letterSpacing || 0}px`, textAlign: el.align || 'center' }} />;
    }
    if (el.tipo === 'qrcode') return <QRCodePreview seed={el.meta?.qrUrl || el.conteudo} color={engravingColor} pixelSize={58} />;
    if (el.tipo === 'spotify') return <SpotifyCodeVisual color={engravingColor} imageSrc={el.meta?.imagem} />;
    if (el.tipo === 'simbolo') return <span className="leading-none" style={{ fontSize: 40, color: engravingColor, fontFamily: 'Georgia, serif' }}>{el.conteudo || '♥'}</span>;
    {/* Achado ao vivo em 20/07/2026: texto não tinha fontSize nenhum (herdava o padrão do navegador,
        ~16px) -- minúsculo perto do produto físico. Símbolo já usa 40px explícito; texto usa um
        pouco menos já que costuma ter mais caracteres. */}
    return <span className="whitespace-pre-wrap text-center inline-block" style={{ width: elementoBox(el).w, color: engravingColor, fontFamily: fonteFamilia(el.fonte), fontSize: 28, lineHeight: el.lineHeight || 1.1, letterSpacing: `${el.letterSpacing || 0}px`, textAlign: el.align || 'center', overflowWrap: 'anywhere' }}>{el.conteudo || 'Texto'}</span>;
  };

  return (
    <div className="h-full min-h-0 flex items-center justify-center" onClick={() => onSelect(null)} style={{ touchAction: 'none' }}>
      <div className="relative select-none" style={{ width: size, height: h }}>
        {imgVerso ? <img src={imgVerso} className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none opacity-95" draggable={false} /> : <div className="absolute inset-0 flex items-center justify-center"><ProdutoFallback tipo={produto?.tipo} cor={produto?.cor} size={size} /></div>}
        {/* Achado ao vivo em 20/07/2026: fixo no canto (não acompanha zoom/posição do elemento) --
            só ativo quando algo está selecionado. Tirado de cima do texto por pedido do usuário. */}
        <button type="button" title="Remover elemento selecionado" disabled={!selectedId} onClick={e => { e.stopPropagation(); if (selectedId) removeEl(selectedId); }} className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-red-600 text-white ring-2 ring-white flex items-center justify-center shadow-lg shadow-black/25 active:scale-95 transition-all disabled:opacity-0 disabled:pointer-events-none"><Trash2 size={14} /></button>
        <div className="absolute inset-0 overflow-visible">
          {elementos.map((el, idx) => {
            const selected = selectedId === el.id;
            const box = elementoBox(el);
            return (
              <div key={el.id} className="absolute left-1/2 top-1/2 flex items-center justify-center" style={{ zIndex: idx + 1, minWidth: 64, minHeight: 64, transform: `translate(-50%, -50%) translate(${el.x}px, ${el.y}px) rotate(${el.rotacao}deg) scale(${el.escala})`, transformOrigin: 'center' }} onClick={e => { e.stopPropagation(); onSelect(el.id); }} onDoubleClick={e => { e.stopPropagation(); onSelect(el.id); if (el.tipo === 'texto') setEditingId(el.id); }} onPointerDown={e => {
                  e.stopPropagation();
                  if ((e.target as HTMLElement).tagName.toLowerCase() === 'textarea') return;
                  onSelect(el.id);
                  activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                  if (activePointers.current.size >= 2 && (drag.current?.id === el.id || !drag.current)) {
                    const [p1, p2] = Array.from(activePointers.current.values()).slice(0, 2);
                    pinchStart.current = { id: el.id, distance: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)), startEscala: el.escala };
                    drag.current = null;
                    return;
                  }
                  drag.current = { id: el.id, startX: e.clientX, startY: e.clientY, baseX: el.x, baseY: el.y };
                }} onWheel={e => { e.preventDefault(); e.stopPropagation(); updateEl(el.id, { escala: clamp(el.escala * (e.deltaY < 0 ? 1.08 : 0.92), 0.2, 6) }); }}>
                <div className="relative inline-flex items-center justify-center overflow-visible" style={{ width: box.w, height: box.h }}>
                  {renderConteudo(el)}
                  {selected && (
                    <>
                      <div className="absolute -inset-1 border-2 border-white rounded pointer-events-none shadow-[0_0_0_1px_rgba(6,17,31,.35)]" />
                      {/* Achado ao vivo em 20/07/2026: os botões flutuantes são filhos da div que já leva
                          scale(el.escala) -- sem a escala inversa aqui, dar zoom no texto também engordava
                          os botões até tampar o texto inteiro. Compensa com scale(1/escala) mantendo o
                          tamanho visual sempre igual, independente do zoom do elemento. "Remover" saiu
                          daqui e virou um ícone fixo no canto do mockup, por pedido do usuário -- fica só
                          Girar (mantido) e Tamanho (mantido por enquanto, até confirmar que o pinça com
                          os dedos funciona bem no celular real; aí dá pra tirar também). */}
                      <button type="button" title="Girar" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); action.current = { id: el.id, startX: e.clientX, startY: e.clientY, escala: el.escala, rotacao: el.rotacao, mode: 'rotate' }; }} style={{ transform: `translateX(-50%) scale(${1 / Math.max(0.01, el.escala)})` }} className="absolute left-1/2 -top-10 w-9 h-9 rounded-full bg-[#06111F] text-white ring-2 ring-white flex items-center justify-center shadow-lg shadow-black/25 active:scale-95 transition-transform"><RotateCcw size={14} /></button>
                      <button type="button" title="Tamanho" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); action.current = { id: el.id, startX: e.clientX, startY: e.clientY, escala: el.escala, rotacao: el.rotacao, mode: 'scale' }; }} style={{ transform: `scale(${1 / Math.max(0.01, el.escala)})` }} className="absolute -right-3 -bottom-3 w-7 h-7 rounded-full bg-[#06111F] text-white ring-2 ring-white flex items-center justify-center shadow-lg shadow-black/25 active:scale-95 transition-transform"><Maximize2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
