/**
 * HemoGest — cliente HTTP central.
 * Guarda tokens em memória (não em localStorage — evita XSS roubando o
 * token; o preço é perder a sessão ao recarregar a página, aceitável para
 * este estágio do projeto). Renova o access token automaticamente em um
 * 401, repetindo a requisição original uma única vez.
 */
const API_BASE = "/api/v1";

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  unidadeHospitalarId: string | null; // usado só pelo Admin Global (header X-Unidade-Id)
}

const state: TokenState = {
  accessToken: null,
  refreshToken: null,
  unidadeHospitalarId: null,
};

export function setTokens(accessToken: string, refreshToken: string) {
  state.accessToken = accessToken;
  state.refreshToken = refreshToken;
}

export function clearTokens() {
  state.accessToken = null;
  state.refreshToken = null;
}

export function setUnidadeAtiva(unidadeId: string | null) {
  state.unidadeHospitalarId = unidadeId;
}

export function isAutenticado(): boolean {
  return state.accessToken !== null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!state.refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: state.refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

async function request<T>(path: string, options: RequestInit = {}, _retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (state.accessToken) headers.set("Authorization", `Bearer ${state.accessToken}`);
  if (state.unidadeHospitalarId) headers.set("X-Unidade-Id", state.unidadeHospitalarId);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && _retry) {
    const renovou = await refreshAccessToken();
    if (renovou) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* corpo vazio, ex: 204 */
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Upload multipart (anexos, logo da unidade) — não passa por JSON.stringify
 * nem pelo Content-Type: application/json do `request` acima. */
export async function uploadFile<T>(path: string, file: File, fieldName = "arquivo"): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);

  const headers = new Headers();
  if (state.accessToken) headers.set("Authorization", `Bearer ${state.accessToken}`);
  if (state.unidadeHospitalarId) headers.set("X-Unidade-Id", state.unidadeHospitalarId);

  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}

export { ApiError };
