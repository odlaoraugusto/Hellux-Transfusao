/** Rótulos e formatadores compartilhados pelo formulário público, pela
 * lista de formulários recebidos e pela visualização para impressão. */
import type { FormularioSolicitacao, Modificacao, TipoHemocomponente } from "@/types";

export const MODALIDADES: { valor: FormularioSolicitacao["modalidade"]; rotulo: string; dica?: string }[] = [
  { valor: "PROGRAMADA", rotulo: "Programada" },
  { valor: "ROTINA", rotulo: "Rotina", dica: "Até 24 h" },
  { valor: "URGENCIA", rotulo: "Urgência", dica: "Até 3 h" },
  { valor: "EMERGENCIA", rotulo: "Emergência", dica: "Risco à vida" },
];

export const MODALIDADE_ROTULO: Record<string, string> = Object.fromEntries(MODALIDADES.map((m) => [m.valor, m.rotulo]));

export const RACAS = ["Branca", "Preta", "Parda", "Amarela", "Indígena"] as const;

/** Unidades/enfermarias fixas desta unidade hospitalar (2026-09-30, pedido
 * do cliente) — mesma lista validada no backend (SetorFixo, ver
 * app/schemas/formulario_solicitacao.py). */
export const SETORES = [
  "UTI Neonatal", "UTI Pediátrica", "Enfermaria Pediátrica", "UCINCo", "Canguru", "UCINCa",
  "Emergência Pediátrica", "Emergência Obstétrica", "Centro Obstétrico", "Centro Cirúrgico",
  "Alojamento Conjunto",
] as const;

export const OPCOES_INDICACAO = [
  { valor: "USO", rotulo: "Uso" },
  { valor: "RESERVA", rotulo: "Reserva" },
] as const;

export const NOME_MODIFICACAO: Record<Modificacao, string> = {
  ALI: "Aliquotagem",
  FIL: "Filtração",
  IRR: "Irradiação",
  LAV: "Lavagem",
};

/** Os 4 hemocomponentes fixos do documento oficial (STH Rev.5), na ordem em
 * que aparecem no papel — cada um só aceita as modificações que fazem
 * sentido clinicamente para ele (mesma regra do backend, ver
 * app/schemas/formulario_solicitacao.py MODIFICACOES_POR_TIPO). */
export const HEMOCOMPONENTES: { tipo: TipoHemocomponente; nome: string; modificacoes: Modificacao[] }[] = [
  { tipo: "CH", nome: "Concentrado de Hemácias", modificacoes: ["ALI", "FIL", "IRR", "LAV"] },
  { tipo: "PF", nome: "Plasma Fresco", modificacoes: ["ALI"] },
  { tipo: "CP", nome: "Concentrado de Plaquetas", modificacoes: ["ALI", "FIL", "IRR"] },
  { tipo: "CR", nome: "Crioprecipitado", modificacoes: [] },
];

export const NOME_TIPO_HEMOCOMPONENTE: Record<TipoHemocomponente, string> = Object.fromEntries(
  HEMOCOMPONENTES.map((h) => [h.tipo, h.nome]),
) as Record<TipoHemocomponente, string>;

/** "2026-09-28" -> "28/09/2026", sem passar por Date (evita erro de fuso). */
export function formatarDataIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "14:35:00" -> "14:35" */
export function formatarHora(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : "—";
}

/** Idade em anos, meses e dias na data da solicitação (recém-nascido pode ter só dias). */
export function calcularIdade(nascimentoIso: string, referenciaIso?: string): string {
  if (!nascimentoIso) return "";
  const [na, nm, nd] = nascimentoIso.split("-").map(Number);
  const ref = referenciaIso ? referenciaIso.split("-").map(Number) : null;
  const hoje = ref ? new Date(ref[0], ref[1] - 1, ref[2]) : new Date();
  let anos = hoje.getFullYear() - na;
  let meses = hoje.getMonth() + 1 - nm;
  let dias = hoje.getDate() - nd;
  if (dias < 0) {
    meses--;
    dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  if (anos < 0) return "";
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
  if (dias > 0 || partes.length === 0) partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);
  return partes.join(", ");
}

export function formatarPeso(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}
