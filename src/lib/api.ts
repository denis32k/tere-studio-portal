const API_BASE = String(import.meta.env.VITE_LICENSE_SERVER_URL || 'http://127.0.0.1:8791').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'tere_previa_portal_token';

export function getToken(): string {
  try { return window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
}
export function setToken(token: string) {
  try { window.localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
}
export function clearToken() {
  try { window.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, {
      method: opts.method || 'POST',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Não consegui conectar. Confira sua internet e tente novamente.', 0);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.ok === false) {
    if (opts.auth && resp.status === 401) clearToken();
    throw new ApiError(data?.error || 'Algo deu errado. Tente novamente.', resp.status, data?.code);
  }
  return data as T;
}

export type ClienteResumo = { nome: string; loja: string };

export function portalLoginRequest(email: string, documento: string) {
  return request<{ ok: true; precisaCodigo: boolean; message?: string }>('/portal/login-request', { body: { email, documento } });
}
export function portalLoginCodeConfirm(email: string, documento: string, code: string) {
  return request<{ ok: true; pendingToken: string; cliente: ClienteResumo }>('/portal/login-code-confirm', { body: { email, documento, code } });
}
export function portalSetPassword(pendingToken: string, password: string) {
  return request<{ ok: true; token: string; cliente: ClienteResumo }>('/portal/set-password', { body: { pendingToken, password } });
}
export function portalLogin(email: string, password: string) {
  return request<{ ok: true; token: string; cliente: ClienteResumo }>('/portal/login', { body: { email, password } });
}
export function portalLogout() {
  return request<{ ok: true }>('/portal/logout', { auth: true }).catch(() => undefined);
}
export function portalCatalogGet() {
  return request<{ ok: true; catalog: { produtos: unknown[]; mockups: unknown[]; updatedAt: string } }>('/portal/catalog', { method: 'GET', auth: true });
}

export { API_BASE };
