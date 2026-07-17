import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Brush, Download, Eraser, FlipHorizontal, Image as ImageIcon, Layers2, Loader2,
  QrCode, Send, Sparkles, Trash2, Type, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { Screen } from '../components/ui';
import { IconButton, ToolBlock, RangeField, FormModal, SymbolsModal, watermarkAssetPadrao } from '../editor/ui';
import { FrenteCanvas } from '../editor/FrenteCanvas';
import { VersoCanvas } from '../editor/VersoCanvas';
import { corNome, modoVersoPadrao } from '../editor/normalize';
import { gerarPreviewCanvas, compartilharOuBaixarPreview, canvasToBlob, nomeArquivoPreview } from '../editor/preview';
import { clamp, projetoTransformPadrao, uid, type PaintStroke, type PhotoTransform, type Produto, type ProductMockup, type VersoElemento, type VersoModoGravacao } from '../editor/types';
import type { ClienteResumo } from '../lib/api';

const MAX_IMAGE_DIM = 1000;
const JPEG_QUALITY = 0.78;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}
function blobToPreviewDataUrl(blob: Blob, maxDim = MAX_IMAGE_DIM, quality = JPEG_QUALITY): Promise<string> {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const w = Math.max(1, Math.round((img.naturalWidth || 1) * ratio));
          const h = Math.max(1, Math.round((img.naturalHeight || 1) * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) { URL.revokeObjectURL(url); blobToDataUrl(blob).then(resolve); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch { URL.revokeObjectURL(url); blobToDataUrl(blob).then(resolve); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); blobToDataUrl(blob).then(resolve); };
      img.src = url;
    } catch { blobToDataUrl(blob).then(resolve); }
  });
}
function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 380 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export default function EditorPage({ produto, mockup, cliente, onVoltar }: { produto: Produto; mockup: ProductMockup; cliente: ClienteResumo | null; onVoltar: () => void }) {
  const [aba, setAba] = useState<'frente' | 'verso'>('frente');
  const [frenteImagem, setFrenteImagem] = useState<string | undefined>();
  const [frenteTransform, setFrenteTransform] = useState<PhotoTransform>(() => projetoTransformPadrao());
  const [frenteRetoques, setFrenteRetoques] = useState<PaintStroke[]>([]);
  const [retoqueFrenteModo, setRetoqueFrenteModo] = useState<'erase' | 'add' | null>(null);
  const [retoquePincel, setRetoquePincel] = useState(4);
  const [versoModoGravacao, setVersoModoGravacao] = useState<VersoModoGravacao>(() => modoVersoPadrao(produto, mockup));
  const [versoElementos, setVersoElementosRaw] = useState<VersoElemento[]>([]);
  const setVersoElementos = (updater: VersoElemento[] | ((prev: VersoElemento[]) => VersoElemento[])) => {
    setVersoElementosRaw(prev => (typeof updater === 'function' ? updater(prev) : updater));
  };
  const [selected, setSelected] = useState<'frente_foto' | string | null>(null);
  const selectedVerso = typeof selected === 'string' && selected !== 'frente_foto' ? versoElementos.find(e => e.id === selected) || null : null;
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState('');
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [gerandoPreview, setGerandoPreview] = useState<'compartilhar' | 'baixar' | null>(null);
  const [resultadoMsg, setResultadoMsg] = useState('');
  const [textoVerso, setTextoVerso] = useState('');
  const [qrConteudo, setQrConteudo] = useState('');
  const frenteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(''), 3200); return () => clearTimeout(t); } }, [msg]);

  const viewportWidth = useViewportWidth();
  const baseSize = Math.min(viewportWidth - 40, 380);
  const canvasSize = Math.round(baseSize * zoom);

  const uploadFrente = async (file?: File | null) => {
    if (!file) return;
    setMsg('Otimizando foto...');
    const preview = await blobToPreviewDataUrl(file, MAX_IMAGE_DIM, JPEG_QUALITY);
    setFrenteImagem(preview);
    setFrenteRetoques([]);
    setRetoqueFrenteModo(null);
    setSelected('frente_foto');
    setMsg('Foto adicionada.');
    try { if (frenteInputRef.current) frenteInputRef.current.value = ''; } catch {}
  };

  const addTexto = () => {
    const texto = textoVerso.trim();
    if (!texto) { setMsg('Digite o texto do verso.'); return; }
    const el: VersoElemento = { id: uid('txt'), tipo: 'texto', conteudo: texto, fonte: 'Letra 1', x: 0, y: 0, escala: 1, rotacao: 0, lineHeight: 1.1, letterSpacing: 0, align: 'center' };
    setVersoElementos(prev => [...prev, el]);
    setSelected(el.id);
    setTextoVerso('');
    setTextModalOpen(false);
  };
  const addQr = () => {
    const valor = qrConteudo.trim();
    if (!valor) { setMsg('Digite ou cole o link do QR Code.'); return; }
    const el: VersoElemento = { id: uid('qr'), tipo: 'qrcode', conteudo: valor, x: 0, y: 0, escala: 0.95, rotacao: 0, lineHeight: 1, letterSpacing: 0, align: 'center', meta: { qrUrl: valor } };
    setVersoElementos(prev => [...prev, el]);
    setSelected(el.id);
    setQrConteudo('');
    setQrModalOpen(false);
  };
  const addSimbolo = (s: string) => {
    const el: VersoElemento = { id: uid('simbolo'), tipo: 'simbolo', conteudo: s, x: 0, y: 0, escala: 1, rotacao: 0, lineHeight: 1, letterSpacing: 0, align: 'center' };
    setVersoElementos(prev => [...prev, el]);
    setSelected(el.id);
  };

  const temConteudo = Boolean(frenteImagem) || versoElementos.length > 0;

  const gerar = async (acao: 'compartilhar' | 'baixar', comMarcaDagua: boolean) => {
    setGerandoPreview(acao);
    setResultadoMsg('');
    try {
      const canvas = await gerarPreviewCanvas({
        produto, mockup, frenteImagem, frenteTransform, mockupFrenteSize: canvasSize,
        versoElementos, versoModoGravacao, mockupVersoSize: canvasSize,
        watermarkAsset: watermarkAssetPadrao(cliente?.loja), comMarcaDagua,
      });
      if (acao === 'baixar') {
        const blob = await canvasToBlob(canvas);
        if (!blob) throw new Error('Não consegui gerar a imagem.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = nomeArquivoPreview(produto, versoElementos.length > 0);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setResultadoMsg('Prévia baixada.');
      } else {
        const resultado = await compartilharOuBaixarPreview(canvas, produto, versoElementos.length > 0);
        if (resultado === 'compartilhado') setResultadoMsg('Prévia enviada.');
        else if (resultado === 'baixado') setResultadoMsg('Seu navegador não permite anexar direto — a prévia foi baixada, é só anexar no WhatsApp.');
      }
      setPreviewModalOpen(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui gerar a prévia agora.');
    } finally {
      setGerandoPreview(null);
    }
  };

  const compartilhamentoDisponivel = useMemo(() => {
    try { return typeof navigator.share === 'function'; } catch { return false; }
  }, []);

  return (
    <Screen>
      <SymbolsModal open={symbolsOpen} onClose={() => setSymbolsOpen(false)} onPick={addSimbolo} />
      <FormModal open={textModalOpen} title="Adicionar texto" description="Digite o texto que vai no verso." onCancel={() => setTextModalOpen(false)} onConfirm={addTexto} confirmDisabled={!textoVerso.trim()}>
        <textarea value={textoVerso} onChange={e => setTextoVerso(e.target.value)} rows={4} autoFocus className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-[#06111F] resize-none" placeholder="Digite o texto" />
      </FormModal>
      <FormModal open={qrModalOpen} title="Adicionar QR Code" description="Cole o link. O QR Code é gerado na hora." onCancel={() => setQrModalOpen(false)} onConfirm={addQr} confirmDisabled={!qrConteudo.trim()}>
        <input value={qrConteudo} onChange={e => setQrConteudo(e.target.value)} className="w-full h-12 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-[#06111F]" placeholder="https://..." />
      </FormModal>

      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden safe-bottom">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Gerar prévia</h3>
              <button className="w-8 h-8 rounded-full active:bg-secondary flex items-center justify-center" onClick={() => !gerandoPreview && setPreviewModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {resultadoMsg && <p className="rounded-xl bg-[#F7F3EB] border border-[#EAC783]/60 text-[#6B5A32] text-xs px-3 py-2.5">{resultadoMsg}</p>}
              <button type="button" onClick={() => gerar('compartilhar', true)} disabled={Boolean(gerandoPreview)} className="h-14 w-full rounded-2xl bg-[#25D366] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {gerandoPreview === 'compartilhar' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {compartilhamentoDisponivel ? 'Enviar pelo WhatsApp' : 'Baixar prévia'}
              </button>
              <button type="button" onClick={() => gerar('baixar', true)} disabled={Boolean(gerandoPreview)} className="h-12 w-full rounded-2xl border border-border bg-background text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {gerandoPreview === 'baixar' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Baixar com marca d'água
              </button>
              <button type="button" onClick={() => gerar('baixar', false)} disabled={Boolean(gerandoPreview)} className="h-11 w-full rounded-2xl text-xs font-semibold text-muted-foreground disabled:opacity-60">
                Baixar sem marca d'água
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-2 flex items-center gap-2 flex-shrink-0">
        <button onClick={onVoltar} className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center flex-shrink-0"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{mockup.produtoNome || mockup.nome || produto.nome}</p>
          <p className="text-[11px] text-muted-foreground">{corNome(produto.cor)}</p>
        </div>
      </div>

      {msg && <div className="mx-4 mb-2 rounded-xl bg-[#F7F3EB] border border-[#EAC783]/60 text-[#6B5A32] text-xs px-3 py-2 flex-shrink-0">{msg}</div>}

      <div className="px-4 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
          <button onClick={() => { setAba('frente'); setSelected(null); }} className={`h-10 rounded-xl text-sm font-semibold transition ${aba === 'frente' ? 'bg-[#06111F] text-white shadow-sm' : 'text-muted-foreground'}`}>Frente</button>
          <button onClick={() => { setAba('verso'); setSelected(null); }} className={`h-10 rounded-xl text-sm font-semibold transition ${aba === 'verso' ? 'bg-[#06111F] text-white shadow-sm' : 'text-muted-foreground'}`}>Verso</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-4 pt-3">
          <IconButton compact onClick={() => setZoom(z => clamp(z / 1.12, 0.75, 2))}><ZoomOut size={16} /></IconButton>
          <IconButton compact onClick={() => setZoom(z => clamp(z * 1.12, 0.75, 2))}><ZoomIn size={16} /></IconButton>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-3 overflow-auto">
          {aba === 'frente' ? (
            <FrenteCanvas
              produto={produto} mockup={mockup} photoUrl={frenteImagem} transform={frenteTransform}
              retouchStrokes={frenteRetoques} retouchMode={retoqueFrenteModo} brushSizePct={retoquePincel}
              onRetouchStroke={stroke => setFrenteRetoques(prev => [...prev, stroke].slice(-500))}
              onCancelRetouch={() => setRetoqueFrenteModo(null)} onTransformChange={setFrenteTransform}
              selected={selected === 'frente_foto'} onSelect={() => setSelected('frente_foto')}
              onRemove={() => { setFrenteImagem(undefined); setFrenteRetoques([]); setRetoqueFrenteModo(null); setSelected(null); }}
              size={canvasSize}
            />
          ) : (
            <VersoCanvas
              produto={produto} mockup={mockup} elementos={versoElementos}
              selectedId={typeof selected === 'string' && selected !== 'frente_foto' ? selected : null}
              onSelect={setSelected} onChange={setVersoElementos} modoGravacao={versoModoGravacao} size={canvasSize}
            />
          )}
        </div>

        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3 space-y-2.5 safe-bottom max-h-[38vh] overflow-y-auto">
          {aba === 'frente' ? (
            <>
              <input ref={frenteInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => uploadFrente(e.target.files?.[0])} />
              {!frenteImagem ? (
                <button onClick={() => frenteInputRef.current?.click()} className="w-full h-14 rounded-2xl border border-dashed border-[#C8A96E]/60 bg-[#F7F3EB] flex items-center justify-center gap-2 text-sm font-semibold text-[#6B5A32]">
                  <Upload size={16} />Enviar foto
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <IconButton onClick={() => frenteInputRef.current?.click()}><ImageIcon size={16} /></IconButton>
                  <IconButton onClick={() => setFrenteTransform(t => ({ ...t, rotation: (t.rotation + 90) % 360 }))}>90°</IconButton>
                  <IconButton onClick={() => setFrenteTransform(t => ({ ...t, flipH: !t.flipH }))}><FlipHorizontal size={16} /></IconButton>
                  <IconButton active={Boolean(retoqueFrenteModo)} onClick={() => setRetoqueFrenteModo(m => (m ? null : 'erase'))}><Eraser size={16} /></IconButton>
                </div>
              )}
              {retoqueFrenteModo && (
                <ToolBlock title="Retoque manual">
                  <div className="grid grid-cols-2 gap-2">
                    <IconButton active={retoqueFrenteModo === 'erase'} onClick={() => setRetoqueFrenteModo('erase')}><Eraser size={14} />Apagar</IconButton>
                    <IconButton active={retoqueFrenteModo === 'add'} onClick={() => setRetoqueFrenteModo('add')}><Brush size={14} />Restaurar</IconButton>
                  </div>
                  <RangeField label="Tamanho do pincel" value={retoquePincel} min={1} max={14} step={0.5} onChange={setRetoquePincel} />
                  <IconButton disabled={!frenteRetoques.length} onClick={() => { setFrenteRetoques([]); setRetoqueFrenteModo(null); }} className="w-full justify-center">Limpar retoques</IconButton>
                </ToolBlock>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <IconButton active={versoModoGravacao === 'preta'} onClick={() => setVersoModoGravacao('preta')}>Gravação preta</IconButton>
                <IconButton active={versoModoGravacao === 'remover_tinta'} onClick={() => setVersoModoGravacao('remover_tinta')}>Remover tinta</IconButton>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <IconButton onClick={() => setTextModalOpen(true)} className="flex-col h-16"><Type size={18} /><span className="mt-1">Texto</span></IconButton>
                <IconButton onClick={() => setSymbolsOpen(true)} className="flex-col h-16"><Sparkles size={18} /><span className="mt-1">Símbolo</span></IconButton>
                <IconButton onClick={() => setQrModalOpen(true)} className="flex-col h-16"><QrCode size={18} /><span className="mt-1">QR Code</span></IconButton>
              </div>
              {selectedVerso && (
                <ToolBlock title={selectedVerso.tipo === 'texto' ? 'Texto selecionado' : 'Camada selecionada'}>
                  <div className="grid grid-cols-2 gap-2">
                    <IconButton onClick={() => setVersoElementos(prev => prev.map(e => e.id === selectedVerso.id ? { ...e, rotacao: (e.rotacao + 90) % 360 } : e))}>90°</IconButton>
                    <IconButton onClick={() => { setVersoElementos(prev => prev.filter(e => e.id !== selectedVerso.id)); setSelected(null); }}><Trash2 size={14} />Remover</IconButton>
                  </div>
                </ToolBlock>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-4 pt-2 safe-bottom">
        <button onClick={() => temConteudo && setPreviewModalOpen(true)} disabled={!temConteudo} className="h-14 w-full rounded-2xl bg-[#06111F] text-[#F7F4EF] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
          <Layers2 size={16} />Gerar prévia
        </button>
      </div>
    </Screen>
  );
}
