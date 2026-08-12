import {
  LayoutDashboard,
  Building2,
  Users,
  Droplet,
  Activity,
  AlertTriangle,
  Undo2,
  BarChart3,
  Gauge,
  SlidersHorizontal,
  UserCog,
  History,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

const ITENS = [
  { to: "/", label: "Dashboard", icone: LayoutDashboard },
  { to: "/unidade", label: "Unidade Hospitalar", icone: Building2 },
  { to: "/pacientes", label: "Pacientes", icone: Users },
  { to: "/hemocomponentes", label: "Hemocomponentes", icone: Droplet },
  { to: "/acompanhamentos", label: "Acompanhamento", icone: Activity },
  { to: "/reacoes", label: "Reações Transfusionais", icone: AlertTriangle },
  { to: "/devolucoes-descartes", label: "Devoluções / Descartes", icone: Undo2 },
  { to: "/relatorios", label: "Relatórios", icone: BarChart3 },
  { to: "/indicadores", label: "Indicadores", icone: Gauge },
  { to: "/parametrizacoes", label: "Parametrizações", icone: SlidersHorizontal },
  { to: "/usuarios", label: "Usuários", icone: UserCog },
  { to: "/auditoria", label: "Auditoria", icone: History },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-200 bg-surface-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/brand/hemogest-simbolo.svg" alt="HemoGest" className="h-9 w-9" />
        <span className="text-lg font-semibold text-hemo">HemoGest</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {ITENS.map(({ to, label, icone: Icone }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive ? "bg-hemo text-white" : "text-ink-muted hover:bg-neutral-100",
              )
            }
          >
            <Icone size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
