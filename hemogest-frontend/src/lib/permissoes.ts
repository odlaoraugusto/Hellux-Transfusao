/** Catálogo das ações configuráveis pela tela Permissões (2026-09-30,
 * pedido do cliente) — mesmas chaves aceitas por
 * `PATCH /roles/{id}/permissoes` no backend (ver
 * app.core.permissions.PERMISSOES_CONFIGURAVEIS). Só Biomédico e Técnico
 * têm matriz configurável; Admin Global e Supervisor sempre têm tudo
 * liberado e não aparecem aqui (mesmo padrão do projeto irmão
 * Almoxarifado). */
export const ACOES_CONFIGURAVEIS: { chave: string; rotulo: string; ajuda: string }[] = [
  { chave: "pacientes_gerenciar", rotulo: "Pacientes", ajuda: "Cadastrar e editar pacientes." },
  { chave: "internacoes_gerenciar", rotulo: "Internações", ajuda: "Abrir internação, mudar de setor, dar alta." },
  { chave: "solicitacoes_gerenciar", rotulo: "Solicitações", ajuda: "Criar, processar e entregar solicitações transfusionais." },
  { chave: "hemocomponentes_bolsas_gerenciar", rotulo: "Hemocomponentes (bolsas)", ajuda: "Entrada de bolsas, fracionamento e reserva." },
  { chave: "acompanhamentos_gerenciar", rotulo: "Acompanhamento transfusional", ajuda: "Abrir acompanhamento e registrar sinais vitais." },
  { chave: "reacoes_gerenciar", rotulo: "Reações transfusionais", ajuda: "Abrir, investigar e encerrar reações transfusionais." },
  { chave: "devolucoes_descartes_gerenciar", rotulo: "Devoluções e descartes", ajuda: "Registrar devolução ou descarte de bolsa." },
  { chave: "anexos_gerenciar", rotulo: "Anexos", ajuda: "Enviar e excluir arquivos anexados aos registros." },
];

export const PERFIS_CONFIGURAVEIS: { codigo: "BIOMEDICO" | "TECNICO"; rotulo: string }[] = [
  { codigo: "BIOMEDICO", rotulo: "Biomédico" },
  { codigo: "TECNICO", rotulo: "Técnico" },
];

/** Admin Global e Supervisor sempre veem tudo liberado; só eles acessam a
 * própria tela Permissões. */
export function podeGerenciarPermissoes(roleCodigo: string | null | undefined): boolean {
  return roleCodigo === "ADMIN_GLOBAL" || roleCodigo === "SUPERVISOR" || roleCodigo === "RT";
}

/** Controle de acesso por TELA (menu + rota), separado da matriz de AÇÕES
 * acima — 2026-09-30, pedido do cliente: Técnico só pode acessar Pacientes,
 * Solicitações e Devoluções/Descartes, mesmo tendo ações liberadas na
 * matriz (a matriz só controla o que ele pode fazer dentro das telas que
 * já tem acesso). Dashboard tirado do Técnico também (2026-10-02, pedido
 * do cliente). Admin Global, Supervisor e Biomédico continuam vendo o
 * sistema inteiro — só Técnico é restrito por enquanto. */
const ROTAS_PERMITIDAS_TECNICO = ["/pacientes", "/solicitacoes", "/devolucoes-descartes", "/conta/senha"];

export function rotaPermitidaParaRole(roleCodigo: string | null | undefined, pathname: string): boolean {
  if (roleCodigo !== "TECNICO") return true;
  // Reimpressão de formulário e Folha de Hemotransfusão são ações dentro de
  // Solicitações, não telas próprias.
  if (/^\/formularios\/[^/]+\/imprimir$/.test(pathname)) return true;
  if (/^\/solicitacoes\/[^/]+\/bolsas\/[^/]+\/folha$/.test(pathname)) return true;
  return ROTAS_PERMITIDAS_TECNICO.includes(pathname);
}

const ROTA_INICIAL_POR_ROLE: Record<string, string> = { TECNICO: "/solicitacoes" };

export function rotaInicial(roleCodigo: string | null | undefined): string {
  return ROTA_INICIAL_POR_ROLE[roleCodigo ?? ""] ?? "/";
}
