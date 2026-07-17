import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import EditorPage from './pages/EditorPage';
import { getToken, setToken, clearToken, portalLogout, type ClienteResumo } from './lib/api';
import { loadStoredCliente, storeCliente } from './lib/auth';
import type { Produto, ProductMockup } from './editor/types';

type Selecao = { produto: Produto; mockup: ProductMockup } | null;

export default function App() {
  const [token, setTokenState] = useState(() => getToken());
  const [cliente, setClienteState] = useState<ClienteResumo | null>(() => loadStoredCliente());
  const [selecao, setSelecao] = useState<Selecao>(null);

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

  if (selecao) {
    return (
      <EditorPage
        produto={selecao.produto}
        mockup={selecao.mockup}
        cliente={cliente}
        onVoltar={() => setSelecao(null)}
      />
    );
  }

  return (
    <CatalogPage
      cliente={cliente}
      onSelecionar={(produto, mockup) => setSelecao({ produto, mockup })}
      onLogout={handleLogout}
    />
  );
}
