import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';
import './styles/fonts.css';

// Achado ao vivo em 20/07/2026: a pinça de 2 dedos no editor (Frente/Verso) disparava o ZOOM
// NATIVO da página do navegador ao mesmo tempo que o zoom customizado do elemento -- mesmo com o
// viewport pedindo maximum-scale=1, o Safari/iOS ignora essa restrição especificamente pra pinça.
// Resultado: o elemento crescia E a tela inteira saía do lugar/zoom junto. O editor já trata o
// gesto de pinça por conta própria via Pointer Events, então bloqueia o gesto nativo em toda a
// página -- não interfere com pointerdown/move/up, que são um sistema de eventos separado.
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

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
