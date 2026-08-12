/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta da API em produção (ex: https://hemogest-backend.fly.dev/api/v1).
   * Se não definida, cai no comportamento atual: caminho relativo "/api/v1"
   * (funciona em dev via proxy do Vite, e também funciona em produção se
   * front e back forem servidos sob o mesmo domínio/reverse proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
