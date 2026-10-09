import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { rotaInicial, rotaPermitidaParaRole } from "@/lib/permissoes";

const ROTA_TROCAR_SENHA = "/conta/senha";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) return <p className="p-6 text-ink-muted">Carregando...</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  // Senha temporária (definida por quem criou/resetou a conta) — força a
  // troca antes de liberar o resto do sistema, mesmo padrão já usado nos
  // sistemas irmãos Almoxarifado/Farmácia.
  if (usuario.primeiro_acesso && location.pathname !== ROTA_TROCAR_SENHA) {
    return <Navigate to={ROTA_TROCAR_SENHA} replace />;
  }
  // Acesso por tela (2026-09-30, pedido do cliente) — quem digitar a URL
  // direto, e não só quem usa o menu, também precisa ser barrado.
  if (!rotaPermitidaParaRole(usuario.role_codigo, location.pathname)) {
    return <Navigate to={rotaInicial(usuario.role_codigo)} replace />;
  }
  return <>{children}</>;
}
