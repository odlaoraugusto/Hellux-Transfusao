/**
 * HemoGest — cliente HTTP central.
 * Tokens ficam em memória e espelhados em localStorage, sem validade própria
 * no cliente (2026-10-02, pedido do cliente: "quero que consiga ficar aberto
 * o plantão todo, sem deslogar" — uma janela própria de ~4h, tentada antes,
 * ficava mais curta que a validade real do access token (8h), porque só era
 * renovada quando um 401 forçava um refresh de verdade; sem uso intenso
 * nesse meio tempo, a sessão "expirava" sozinha no navegador mesmo com o
 * token ainda totalmente válido no servidor). Quem baliza a sessão agora é
 * só o próprio par de tokens: access token (expira sozinho, renovado na
 * hora via refresh) e refresh token (ACCESS_TOKEN_EXPIRE_MINUTES /
 * REFRESH_TOKEN_EXPIRE_DAYS no backend) — localStorage só sobrevive ao
 * fechar a aba/navegador, igual antes. Renova o access token automaticamente
 * em um 401, repetindo a requisição original uma única vez.
 */
// Em produção (build), VITE_API_BASE_URL pode apontar pra URL absoluta do
// backend (ex: https://hemogest-backend.fly.dev/api/v1) — necessário se
// front e back forem hosts/domínios diferentes (ver hemogest-backend/DEPLOY.md).
// Sem essa variável definida no build, mantém o comportamento atual: caminho
// relativo, resolvido pelo proxy do Vite em dev.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  unidadeHospitalarId: string | null; // usado só pelo Admin Global (header X-Unidade-Id)
}

const CHAVE_SESSION_STORAGE = "hemogest.tokens";

function lerTokensPersistidos(): { accessToken: string; refreshToken: string } | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSION_STORAGE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    if (typeof dados.accessToken === "string" && typeof dados.refreshToken === "string") return dados;
    return null;
  } catch {
    return null; // modo privado/localStorage bloqueado — cai pro comportamento sem persistência
  }
}

const tokensPersistidos = lerTokensPersistidos();

const state: TokenState = {
  accessToken: tokensPersistidos?.accessToken ?? null,
  refreshToken: tokensPersistidos?.refreshToken ?? null,
  unidadeHospitalarId: null,
};

export function setTokens(accessToken: string, refreshToken: string) {
  state.accessToken = accessToken;
  state.refreshToken = refreshToken;
  try {
    localStorage.setItem(CHAVE_SESSION_STORAGE, JSON.stringify({ accessToken, refreshToken }));
  } catch {
    /* modo privado/localStorage bloqueado — sessão só dura em memória, sem quebrar o login */
  }
}

export function clearTokens() {
  state.accessToken = null;
  state.refreshToken = null;
  try {
    localStorage.removeItem(CHAVE_SESSION_STORAGE);
  } catch {
    /* idem acima */
  }
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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
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
