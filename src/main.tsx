import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';
import './styles/fonts.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  // Assim que uma versão nova do service worker assume o controle da página, recarrega uma vez
  // pra já mostrar ela -- sem isso a pessoa só via a atualização fechando e abrindo o app de novo.
  let recarregandoPorAtualizacao = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregandoPorAtualizacao) return;
    recarregandoPorAtualizacao = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
