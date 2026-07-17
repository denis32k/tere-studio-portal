import { clamp, uid, type CorProduto, type MaskResult, type ProductMockup, type Produto, type VersoModoGravacao } from './types';

export function normalizarTexto(v?: string) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function textoChaveMockup(v?: string) {
  return normalizarTexto(v)
    .replace(/\b(prata|prateado|dourada|dourado|preta|preto|personalizavel|personalizado|personalizada|colar|pingente|chaveiro)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
export function corNome(cor?: CorProduto | null) {
  const id = String(cor || 'prata');
  if (id.startsWith('custom|')) {
    const [, nome] = id.split('|');
    try { return decodeURIComponent(nome || 'Cor personalizada'); } catch { return nome || 'Cor personalizada'; }
  }
  const mapa: Record<string, string> = { prata: 'Prata', prateado: 'Prata', dourada: 'Dourada', dourado: 'Dourada', preta: 'Preta', preto: 'Preta', nao_informar: 'Sem cor' };
  return mapa[id] || id;
}
export function normalizarProduto(p: Partial<Produto> | null | undefined): Produto | null {
  if (!p) return null;
  const id = String(p.id || '').trim();
  const nome = String(p.nome || '').trim();
  if (!id || !nome) return null;
  return { id, nome, tipo: String(p.tipo || 'colar'), cor: String(p.cor || 'prata'), tamanho: String(p.tamanho || ''), valor: Number(p.valor || 0) };
}
export function normalizarProdutos(lista?: Partial<Produto>[] | null): Produto[] {
  return (Array.isArray(lista) ? lista : []).map(normalizarProduto).filter((p): p is Produto => Boolean(p));
}
function normalizarMask(mask?: MaskResult): MaskResult | undefined {
  if (!mask) return undefined;
  const b = mask.bounds;
  if (!b) return mask;
  return {
    ...mask,
    bounds: {
      xPct: clamp(Number(b.xPct || 0), 0, 100),
      yPct: clamp(Number(b.yPct || 0), 0, 100),
      wPct: clamp(Number(b.wPct || 100), 1, 100),
      hPct: clamp(Number(b.hPct || 100), 1, 100),
    },
    shape: mask.shape || 'rect',
  };
}
export function normalizarMockup(m?: Partial<ProductMockup> | null): ProductMockup | null {
  if (!m) return null;
  const frentePng = m.frentePng || m.uploadedPng || undefined;
  const versoPng = m.versoPng || undefined;
  if (!frentePng && !versoPng) return null;
  return {
    ...m,
    id: String(m.id || uid('mock')),
    produtoId: m.produtoId ? String(m.produtoId) : undefined,
    produtoNome: m.produtoNome || m.nome || 'Mockup',
    nome: m.nome || m.produtoNome || 'Mockup',
    tipo: String(m.tipo || 'colar'),
    cor: m.cor ? String(m.cor) : undefined,
    uploadedPng: frentePng,
    frentePng,
    versoPng,
    detectedMask: normalizarMask(m.detectedMask),
    frenteMask: normalizarMask(m.frenteMask || m.detectedMask || m.frenteAutoMask),
    versoMask: normalizarMask(m.versoMask || m.versoAutoMask),
  };
}
export function normalizarMockups(lista?: Partial<ProductMockup>[] | null): ProductMockup[] {
  const map = new Map<string, ProductMockup>();
  (Array.isArray(lista) ? lista : []).forEach(item => {
    const m = normalizarMockup(item);
    if (!m) return;
    const key = m.produtoId ? `${m.produtoId}:${m.cor || ''}` : `${m.id}:${m.cor || ''}`;
    map.set(key, m);
  });
  return Array.from(map.values());
}
export function imagemMockupLado(mockup?: ProductMockup, lado: 'frente' | 'verso' = 'frente', allowFallback = true) {
  if (!mockup) return undefined;
  return lado === 'verso'
    ? (mockup.versoPng || (allowFallback ? (mockup.frentePng || mockup.uploadedPng) : undefined))
    : (mockup.frentePng || mockup.uploadedPng);
}
export function mascaraMockupLado(mockup?: ProductMockup, lado: 'frente' | 'verso' = 'frente') {
  if (!mockup) return undefined;
  return lado === 'verso' ? (mockup.versoMask || mockup.versoAutoMask) : (mockup.frenteMask || mockup.detectedMask || mockup.frenteAutoMask);
}
export function mockupDoProduto(produto?: Produto | null, lista: ProductMockup[] = []) {
  if (!produto) return undefined;
  const comImagem = normalizarMockups(lista).filter(m => Boolean(imagemMockupLado(m, 'frente')));
  const corCompat = (m: ProductMockup) => !m.cor || m.cor === produto.cor;
  const porId = comImagem.find(m => m.produtoId === produto.id && corCompat(m));
  if (porId) return porId;
  const nomeProduto = textoChaveMockup(produto.nome);
  const porNomeExato = comImagem.find(m => corCompat(m) && textoChaveMockup(m.produtoNome || m.nome) === nomeProduto);
  if (porNomeExato) return porNomeExato;
  return undefined;
}
export function produtoThumb(mockup?: ProductMockup) {
  return imagemMockupLado(mockup, 'frente') || imagemMockupLado(mockup, 'verso', false);
}
export function shapePorProduto(produto?: Produto, fallback?: string) {
  const texto = normalizarTexto(`${produto?.tipo || ''} ${produto?.nome || ''}`);
  if (/dog|tag|chaveiro|retang|placa|barra|quadrad/.test(texto)) return 'rect';
  if (/medalha|redond|circular|colar|pingente|coracao|coração/.test(texto)) return 'circle';
  if (fallback === 'ellipse') return 'ellipse';
  if (fallback === 'rect') return 'rect';
  return 'circle';
}
export function modoGravacaoProjeto(produto?: Produto, mockup?: ProductMockup) {
  const cor = String(produto?.cor || '').toLowerCase();
  return mockup?.modoGravacaoPadrao || (cor === 'preta' || cor === 'preto' ? 'remocao_tinta_preta' : 'escurecido_pb');
}
export function modoVersoPadrao(produto?: Produto, mockup?: ProductMockup): VersoModoGravacao {
  const modo = String(modoGravacaoProjeto(produto, mockup) || '').toLowerCase();
  const cor = String(produto?.cor || mockup?.cor || '').toLowerCase();
  return modo.includes('remocao') || modo.includes('remover') || modo.includes('tinta') || cor === 'preta' || cor === 'preto' ? 'remover_tinta' : 'preta';
}
export function corVersoModo(modo: VersoModoGravacao) {
  return modo === 'remover_tinta' ? '#E5E7EB' : '#111827';
}
