import type { FonteVersoConfig } from '../lib/api';

const FONTES_MAX = 9;

function fontesPadrao(): FonteVersoConfig[] {
  return Array.from({ length: FONTES_MAX }, (_, i) => {
    const idx = i + 1;
    return { idx, nome: `Letra ${idx}`, ativaTotem: idx <= 4, ativaPersonalizar: idx <= 4 };
  });
}

// Injeta @font-face pras fontes customizadas (5-9) usando a URL já resolvida pelo servidor --
// as 4 padrão (1-4) já vêm bundladas como asset estático do PWA (ver fonts.css), essas aqui só
// existem se a loja cadastrou upload próprio nas Configurações do desktop.
function aplicarFonteCustomizada(idx: number, url: string) {
  const id = `tere-font-upload-${idx}`;
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = `@font-face{font-family:TereLetra${idx};src:url(${JSON.stringify(url)});font-display:swap;}`;
}

export function aplicarFontesCustomizadas(arquivos: Record<string, string>) {
  Object.entries(arquivos || {}).forEach(([idxRaw, url]) => {
    const idx = Math.min(FONTES_MAX, Math.max(1, Number(idxRaw) || 1));
    if (url) aplicarFonteCustomizada(idx, url);
  });
}

export function fontesAtivasParaPersonalizar(config: FonteVersoConfig[] | null | undefined, arquivos: Record<string, string> | null | undefined): { value: string; label: string; idx: number }[] {
  const base = fontesPadrao();
  const cfg = base.map(item => ({ ...item, ...((config || []).find(s => s.idx === item.idx) || {}) }));
  const disponiveis = cfg.filter(f => f.idx <= 4 || Boolean(arquivos?.[String(f.idx)])).filter(f => f.ativaPersonalizar !== false);
  const ativos = disponiveis.slice(0, FONTES_MAX).map(f => ({ value: `Letra ${f.idx}`, label: f.nome || `Letra ${f.idx}`, idx: f.idx }));
  return ativos.length ? ativos : [{ value: 'Letra 1', label: 'Letra 1', idx: 1 }];
}
