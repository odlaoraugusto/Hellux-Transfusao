import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <p className="p-6 text-ink-muted">Carregando...</p>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
