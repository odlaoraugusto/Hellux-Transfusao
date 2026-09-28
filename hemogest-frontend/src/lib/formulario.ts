/** Rótulos e formatadores compartilhados pelo formulário público, pela
 * lista de formulários recebidos e pela visualização para impressão. */
import type { FormularioSolicitacao } from "@/types";

export const MODALIDADES: { valor: FormularioSolicitacao["modalidade"]; rotulo: string; dica?: string }[] = [
  { valor: "EMERGENCIA", rotulo: "Emergência", dica: "Risco de vida" },
  { valor: "URGENCIA", rotulo: "Urgência", dica: "Até 3 h" },
  { valor: "ROTINA", rotulo: "Rotina", dica: "Até 24 h" },
  { valor: "PROGRAMADA", rotulo: "Programada" },
];

export const MODALIDADE_ROTULO: Record<string, string> = Object.fromEntries(MODALIDADES.map((m) => [m.valor, m.rotulo]));

export const MODIFICACOES = ["Aliquotagem", "Filtração", "Irradiação", "Lavagem"] as const;

export const RACAS = ["Branca", "Preta", "Parda", "Amarela", "Indígena"] as const;

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
