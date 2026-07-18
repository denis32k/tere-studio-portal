export type TipoProduto = string;
export type CorProduto = string;
export type VersoElementoTipo = 'texto' | 'simbolo' | 'qrcode' | 'spotify';

export type Produto = {
  id: string;
  nome: string;
  tipo: TipoProduto;
  cor: CorProduto;
  tamanho?: string;
  valor?: number;
};

export type PaintStroke = { xPct: number; yPct: number; sizePct: number; mode: 'add' | 'erase'; space?: 'image' | 'mask' };
export type MaskResult = {
  clipPath?: string;
  bounds?: { xPct: number; yPct: number; wPct: number; hPct: number };
  shape?: 'rect' | 'circle' | 'ellipse';
  paintStrokes?: PaintStroke[];
  paintOnly?: boolean;
  bitmapDataUrl?: string;
  guardBitmapDataUrl?: string;
};

export type ProductMockup = {
  id: string;
  produtoId?: string;
  produtoNome?: string;
  nome?: string;
  tipo?: TipoProduto;
  cor?: CorProduto;
  uploadedPng?: string;
  detectedMask?: MaskResult;
  frentePng?: string;
  versoPng?: string;
  frenteMask?: MaskResult;
  versoMask?: MaskResult;
  frenteAutoMask?: MaskResult;
  versoAutoMask?: MaskResult;
  modoGravacaoPadrao?: string;
};

export type PhotoTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  brilho: number;
  contraste: number;
};

export type VersoElemento = {
  id: string;
  tipo: VersoElementoTipo;
  conteudo: string;
  fonte?: string;
  x: number;
  y: number;
  escala: number;
  rotacao: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: 'left' | 'center' | 'right';
  meta?: { qrUrl?: string; musica?: string; artista?: string; spotifyUrl?: string; imagem?: string };
};

export type VersoModoGravacao = 'preta' | 'remover_tinta';

export function projetoTransformPadrao(): PhotoTransform {
  return { scale: 1, x: 0, y: 0, rotation: 0, brilho: 100, contraste: 110, flipH: false };
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const SIMBOLOS_PRETOS = Array.from(new Set([
  '🐾︎', '🐾', '🪽︎', '🪽', '𓆩', '𓆪', '𓆩♡𓆪', '𓆩✟𓆪', 'ʚɞ', '༺', '༻', '༶', '𖠋', '𖤓',
  '♥', '♡', '❤', '❥', '❦', '❧', '✦', '✧', '★', '☆', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾', '✿', '❀', '❁', '❂', '❃', '❄', '❅', '❆',
  '☀', '☁', '☂', '☃', '☄', '☾', '☽', '☼', '☘', '☕', '☔', '☙', '☞', '☜', '☝', '☟', '☮', '☯', '☸', '♠', '♣', '♦', '♤', '♧', '♢', '♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟',
  '♪', '♫', '♬', '♩', '♭', '♮', '♯', '✓', '✔', '✕', '✖', '✚', '✜', '✝', '✞', '✟', '✠', '✡', '✢', '✣', '✤', '✥',
  '❈', '❉', '❊', '❋', '❍', '●', '○', '◉', '◎', '◌', '◍', '◆', '◇', '◈', '◊', '■', '□', '▣', '▤', '▥', '▦', '▧', '▨', '▩', '▲', '△', '▶', '▷', '▼', '▽', '◀', '◁', '⬟', '⬢', '⬣', '⬥', '⬦',
  '➤', '➜', '➟', '➠', '➡', '➢', '➣', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➵', '➸', '➺', '➻', '➼', '➽', '➾',
  '∞', '≈', '≠', '≤', '≥', '÷', '×', '±', '§', '¶', '©', '®', '™',
]));
