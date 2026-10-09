import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearTokens, isAutenticado, setTokens, setUnidadeAtiva } from "@/lib/api";
import type { Usuario } from "@/types";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (login: string, senha: string) => Promise<Usuario>;
  logout: () => void;
  /** Rebusca /usuarios/me — usado depois de trocar a senha, pra
   * `primeiro_acesso` virar false sem precisar deslogar e logar de novo. */
  refrescarUsuario: () => Promise<void>;
  /** Unidade hospitalar cujo contexto está ativo nas chamadas à API.
   * Para a maioria dos perfis é fixa (a própria unidade do usuário). Só o
   * Administrador Global não tem unidade própria (atua sobre múltiplas) e
   * por isso pode trocar — ver UnidadeSwitcher, na Navbar. */
  unidadeAtivaId: string | null;
  selecionarUnidadeAtiva: (unidadeId: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [unidadeAtivaId, setUnidadeAtivaId] = useState<string | null>(null);

  const selecionarUnidadeAtiva = useCallback((unidadeId: string | null) => {
    setUnidadeAtiva(unidadeId);
    setUnidadeAtivaId(unidadeId);
  }, []);

  const hidratarUsuario = useCallback(async () => {
    if (!isAutenticado()) {
      setCarregando(false);
      return;
    }
    try {
      const eu = await api.get<Usuario>("/usuarios/me");
      setUsuario(eu);
      selecionarUnidadeAtiva(eu.unidade_hospitalar_id);
    } catch {
      clearTokens();
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, [selecionarUnidadeAtiva]);

  useEffect(() => {
    hidratarUsuario();
  }, [hidratarUsuario]);

  const login = useCallback(
    async (usuarioLogin: string, senha: string) => {
      const tokens = await api.post<{ access_token: string; refresh_token: string }>("/auth/login", {
        login: usuarioLogin,
        senha,
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const eu = await api.get<Usuario>("/usuarios/me");
      setUsuario(eu);
      selecionarUnidadeAtiva(eu.unidade_hospitalar_id);
      return eu;
    },
    [selecionarUnidadeAtiva],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUnidadeAtiva(null);
    setUnidadeAtivaId(null);
    setUsuario(null);
  }, []);

  const refrescarUsuario = useCallback(async () => {
    const eu = await api.get<Usuario>("/usuarios/me");
    setUsuario(eu);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, login, logout, unidadeAtivaId, selecionarUnidadeAtiva, refrescarUsuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
