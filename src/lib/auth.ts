import type { ClienteResumo } from './api';

const CLIENTE_STORAGE_KEY = 'tere_previa_portal_cliente';

export function loadStoredCliente(): ClienteResumo | null {
  try {
    const raw = window.localStorage.getItem(CLIENTE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function storeCliente(cliente: ClienteResumo | null) {
  try {
    if (cliente) window.localStorage.setItem(CLIENTE_STORAGE_KEY, JSON.stringify(cliente));
    else window.localStorage.removeItem(CLIENTE_STORAGE_KEY);
  } catch {}
}
