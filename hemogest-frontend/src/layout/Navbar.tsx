import { useEffect, useState } from "react";
import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { UnidadeHospitalar } from "@/types";

/** Só existe para o Administrador Global: ele não tem unidade própria (atua
 * sobre múltiplas), então precisa escolher em qual unidade está operando
 * antes de acessar telas com dados de uma unidade específica (Dashboard,
 * Pacientes, etc.) — sem isso, essas chamadas voltam 400. */
function UnidadeSwitcher() {
  const { unidadeAtivaId, selecionarUnidadeAtiva } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);

  useEffect(() => {
    api
      .get<UnidadeHospitalar[]>("/unidades-hospitalares")
      .then((lista) => {
        setUnidades(lista);
        if (!unidadeAtivaId && lista.length > 0) {
          selecionarUnidadeAtiva(lista[0].id);
        }
      })
      .catch(() => setUnidades([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <select
      value={unidadeAtivaId ?? ""}
      onChange={(e) => selecionarUnidadeAtiva(e.target.value || null)}
      aria-label="Unidade hospitalar ativa"
      className="rounded-lg border border-neutral-300 bg-surface-card px-2 py-1.5 text-sm text-ink focus:border-hemo focus:outline-none"
    >
      {unidades.length === 0 && <option value="">Nenhuma unidade cadastrada</option>}
      {unidades.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nome_fantasia}
        </option>
      ))}
    </select>
  );
}

export function Navbar() {
  const { tema, alternar } = useTheme();
  const { usuario, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-surface-card px-6 py-3">
      <div>{usuario && usuario.unidade_hospitalar_id === null && <UnidadeSwitcher />}</div>
      <div className="flex items-center gap-4">
        <button
          onClick={alternar}
          aria-label="Alternar tema"
          className="rounded-lg p-2 text-ink-muted hover:bg-neutral-100"
        >
          {tema === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {usuario && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{usuario.nome}</p>
              <p className="text-xs text-ink-muted leading-tight">{usuario.email}</p>
            </div>
            <button
              onClick={logout}
              aria-label="Sair"
              className="rounded-lg p-2 text-ink-muted hover:bg-neutral-100"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
