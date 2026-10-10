import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  AlertTriangle,
  Undo2,
  BarChart3,
  Gauge,
  SlidersHorizontal,
  UserCog,
  ShieldCheck,
  History,
  ClipboardList,
  Droplet,
  Truck,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { podeGerenciarPermissoes, rotaPermitidaParaRole } from "@/lib/permissoes";
import { INSTITUICAO_PRIMARIA, INSTITUICAO_SECUNDARIA } from "@/config/instituicao";
import { LogoInstituicao } from "@/components/LogoInstituicao";
import type { UnidadeHospitalar } from "@/types";

// "Formulários recebidos" saiu do menu (2026-09-30, pedido do cliente) — o
// formulário público já cria a Solicitação automaticamente, então a fila de
// trabalho de verdade é só a de Solicitações; a tela em si continua
// acessível por link direto (histórico do que foi digitado).
//
// "Hemocomponentes" (estoque) e "Solicitação Hemocentro" são módulos
// opcionais (ver MODULOS.md) — cada unidade liga o que usa de
// verdade; quem decide se aparecem no menu é `moduloAtivo` abaixo, não mais
// uma ocultação fixa no código (2026-10-10, antes era "por enquanto não
// teremos estoque de bolsas" via comentário — agora é configurável pelo
// Admin Global em Unidade Hospitalar > Módulos).
const ITENS = [
  { to: "/", label: "Dashboard", icone: LayoutDashboard },
  { to: "/unidade", label: "Unidade Hospitalar", icone: Building2 },
  { to: "/pacientes", label: "Pacientes", icone: Users },
  { to: "/solicitacoes", label: "Solicitações", icone: ClipboardList },
  { to: "/hemocomponentes", label: "Hemocomponentes", icone: Droplet, modulo: "modulo_estoque_ativo" as const },
  {
    to: "/solicitacoes-hemocentro", label: "Solicitação Hemocentro", icone: Truck,
    modulo: "modulo_solicitacao_hemocentro_ativo" as const,
  },
  { to: "/acompanhamentos", label: "Acompanhamento", icone: Activity },
  { to: "/reacoes", label: "Reações Transfusionais", icone: AlertTriangle },
  { to: "/devolucoes-descartes", label: "Devoluções / Descartes", icone: Undo2 },
  { to: "/relatorios", label: "Relatórios", icone: BarChart3 },
  { to: "/indicadores", label: "Indicadores", icone: Gauge },
  { to: "/parametrizacoes", label: "Parametrizações", icone: SlidersHorizontal },
  { to: "/usuarios", label: "Usuários", icone: UserCog },
  { to: "/auditoria", label: "Auditoria", icone: History },
];

function moduloAtivo(item: (typeof ITENS)[number], unidade: UnidadeHospitalar | null): boolean {
  if (!("modulo" in item) || item.modulo === undefined) return true;
  return unidade?.[item.modulo] ?? false;
}

export function Sidebar() {
  const { usuario, unidadeAtiva } = useAuth();
  const base = ITENS
    .filter((item) => moduloAtivo(item, unidadeAtiva))
    .filter((item) => rotaPermitidaParaRole(usuario?.role_codigo, item.to));
  const itens = podeGerenciarPermissoes(usuario?.role_codigo)
    ? [...base, { to: "/permissoes", label: "Permissões", icone: ShieldCheck }]
    : base;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-200 bg-surface-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/brand/hemogest-simbolo.svg" alt="Hellux" className="h-9 w-9" />
        <div className="leading-tight">
          <span className="block text-lg font-semibold text-hemo">Hellux</span>
          <span className="block text-xs text-ink-muted">Módulo de Transfusão</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {itens.map(({ to, label, icone: Icone }) => (
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

      {/* Identidade institucional desta unidade — configurável por ambiente,
       * ver src/config/instituicao.ts (2026-09-30, pedido do cliente). */}
      <div className="flex items-center justify-center gap-2 border-t border-neutral-200 px-4 py-3">
        <LogoInstituicao instituicao={INSTITUICAO_PRIMARIA} className="h-7 w-auto rounded bg-white/90 px-1.5 py-1" />
        {INSTITUICAO_SECUNDARIA && (
          <LogoInstituicao instituicao={INSTITUICAO_SECUNDARIA} className="h-6 w-auto rounded bg-white/90 px-1.5 py-1" />
        )}
      </div>
    </aside>
  );
}
