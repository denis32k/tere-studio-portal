import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import EditorPage from './pages/EditorPage';
import { getToken, setToken, clearToken, portalLogout, portalFontsGet, type ClienteResumo } from './lib/api';
import { loadStoredCliente, storeCliente } from './lib/auth';
import { aplicarFontesCustomizadas, fontesAtivasParaPersonalizar } from './editor/fonts';
import { modeloRemoverFundoJaBaixado, getSessaoRemoverFundo } from './editor/bgRemoval';
import type { Produto, ProductMockup } from './editor/types';

type Selecao = { produto: Produto; mockup: ProductMockup } | null;

export default function App() {
  const [token, setTokenState] = useState(() => getToken());
  const [cliente, setClienteState] = useState<ClienteResumo | null>(() => loadStoredCliente());
  const [selecao, setSelecao] = useState<Selecao>(null);
  const [fontesAtivas, setFontesAtivas] = useState<{ value: string; label: string; idx: number }[]>([{ value: 'Letra 1', label: 'Letra 1', idx: 1 }]);
  const [baixandoModeloPct, setBaixandoModeloPct] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    portalFontsGet()
      .then(resp => {
        if (!ativo) return;
        aplicarFontesCustomizadas(resp.fonts.arquivos);
        setFontesAtivas(fontesAtivasParaPersonalizar(resp.fonts.config, resp.fonts.arquivos));
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    (async () => {
      const jaBaixado = await modeloRemoverFundoJaBaixado().catch(() => false);
      if (!ativo || jaBaixado) return;
      setBaixandoModeloPct(0);
      try {
        await getSessaoRemoverFundo(p => { if (ativo) setBaixandoModeloPct(p.pct); });
      } catch {
        // Sem rede/sem espaço agora -- sem problema, o botão de remover fundo tenta de novo na hora do uso.
      } finally {
        if (ativo) setBaixandoModeloPct(null);
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  const handleLogin = (novoToken: string, novoCliente: ClienteResumo) => {
    setToken(novoToken);
    storeCliente(novoCliente);
    setTokenState(novoToken);
    setClienteState(novoCliente);
  };
  const handleLogout = () => {
    portalLogout();
    clearToken();
    storeCliente(null);
    setTokenState('');
    setClienteState(null);
    setSelecao(null);
  };

  if (!token) return <LoginPage onLogin={handleLogin} />;

  const conteudo = selecao ? (
    <EditorPage
      produto={selecao.produto}
      mockup={selecao.mockup}
      cliente={cliente}
      fontesAtivas={fontesAtivas}
      onVoltar={() => setSelecao(null)}
    />
  ) : (
    <CatalogPage
      cliente={cliente}
      onSelecionar={(produto, mockup) => setSelecao({ produto, mockup })}
      onLogout={handleLogout}
    />
  );

  return (
    <>
      {conteudo}
      {baixandoModeloPct != null && (
        <div className="fixed left-3 right-3 bottom-3 z-[60] rounded-2xl bg-[#06111F] text-[#F7F4EF] shadow-xl px-4 py-3 flex items-center gap-3 safe-bottom">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">Baixando dependências do app...</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-[#C8A96E] transition-all" style={{ width: `${Math.max(4, baixandoModeloPct)}%` }} />
            </div>
          </div>
          <span className="text-[11px] font-mono tabular-nums shrink-0">{baixandoModeloPct}%</span>
        </div>
      )}
    </>
  );
}
