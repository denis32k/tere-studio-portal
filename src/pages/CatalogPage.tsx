import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, Search } from 'lucide-react';
import { Screen, Logo } from '../components/ui';
import { ApiError, portalCatalogGet } from '../lib/api';
import { normalizarProdutos, normalizarMockups, mockupDoProduto, produtoThumb, corNome, normalizarTexto } from '../editor/normalize';
import { ProdutoFallback } from '../editor/ui';
import type { Produto, ProductMockup } from '../editor/types';
import type { ClienteResumo } from '../lib/api';

export default function CatalogPage({ cliente, onSelecionar, onLogout }: { cliente: ClienteResumo | null; onSelecionar: (produto: Produto, mockup: ProductMockup) => void; onLogout: () => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mockups, setMockups] = useState<ProductMockup[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setCarregando(true); setErro('');
    try {
      const resp = await portalCatalogGet();
      setProdutos(normalizarProdutos(resp.catalog.produtos as Partial<Produto>[]));
      setMockups(normalizarMockups(resp.catalog.mockups as Partial<ProductMockup>[]));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não consegui buscar o catálogo agora.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const produtosComMockup = useMemo(() => produtos.filter(p => Boolean(mockupDoProduto(p, mockups))), [produtos, mockups]);
  const termo = normalizarTexto(busca);
  const filtrados = useMemo(() => produtosComMockup.filter(p => {
    const m = mockupDoProduto(p, mockups);
    const text = normalizarTexto(`${p.nome} ${corNome(p.cor)} ${m?.produtoNome || ''} ${m?.nome || ''}`);
    return !termo || text.includes(termo);
  }), [produtosComMockup, mockups, termo]);

  return (
    <Screen>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-shrink-0">
        <Logo />
        <button onClick={onLogout} title="Sair" className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground active:bg-secondary"><LogOut size={16} /></button>
      </div>
      <div className="px-5 pb-3">
        <p className="text-sm text-muted-foreground">{cliente?.loja ? `Loja ${cliente.loja}` : 'Escolha um produto para gerar a prévia.'}</p>
      </div>
      <div className="px-5 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto" className="w-full h-12 rounded-2xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-[#06111F]" />
        </div>
        <button onClick={carregar} title="Recarregar" className="w-12 h-12 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground active:bg-secondary flex-shrink-0"><RefreshCw size={16} className={carregando ? 'animate-spin' : ''} /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8">
        {erro && <p className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs px-3 py-2.5 mb-3">{erro}</p>}
        {carregando && !produtos.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <p className="text-sm text-muted-foreground">Buscando seu catálogo...</p>
          </div>
        ) : filtrados.length ? (
          <div className="grid grid-cols-2 gap-3">
            {filtrados.map(p => {
              const m = mockupDoProduto(p, mockups);
              const thumb = m ? produtoThumb(m) : undefined;
              return (
                <button key={p.id} onClick={() => m && onSelecionar(p, m)} className="rounded-2xl border border-border bg-card p-3 text-left active:scale-[0.98] transition shadow-sm">
                  <div className="w-full aspect-square rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden mb-2">
                    {thumb ? <img src={thumb} className="w-full h-full object-contain" /> : <ProdutoFallback tipo={p.tipo} cor={p.cor} size={110} />}
                  </div>
                  <p className="text-[12.5px] font-semibold leading-tight line-clamp-2">{m?.produtoNome || m?.nome || p.nome}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{corNome(p.cor)}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <p className="text-sm font-medium">{produtos.length ? 'Nenhum produto encontrado' : 'Nenhum produto com mockup ainda'}</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">{produtos.length ? 'Tente buscar por outro nome.' : 'Cadastre produtos e mockups no sistema da loja e puxe de novo aqui.'}</p>
          </div>
        )}
      </div>
    </Screen>
  );
}
