/**
 * Identidade institucional exibida na interface e no PDF da Solicitação de
 * Transfusão — não é mais fixa no código (nome e logos reais de uma
 * instituição específica), vem de variáveis de ambiente definidas no deploy
 * de cada unidade hospitalar. Ver hemogest-frontend/.env.example. Sem
 * configuração, cai num rótulo de texto genérico, nunca assume a identidade
 * de uma instituição real.
 */

export interface IdentidadeInstitucional {
  nome: string;
  logoUrl: string | null;
}

export const INSTITUICAO_PRIMARIA: IdentidadeInstitucional = {
  nome: import.meta.env.VITE_INSTITUICAO_PRIMARIA_NOME?.trim() || "Unidade Hospitalar",
  logoUrl: import.meta.env.VITE_INSTITUICAO_PRIMARIA_LOGO_URL?.trim() || null,
};

/** A instituição parceira/co-mantenedora é opcional — nem toda unidade tem uma. */
export const INSTITUICAO_SECUNDARIA: IdentidadeInstitucional | null = import.meta.env
  .VITE_INSTITUICAO_SECUNDARIA_NOME?.trim()
  ? {
      nome: import.meta.env.VITE_INSTITUICAO_SECUNDARIA_NOME.trim(),
      logoUrl: import.meta.env.VITE_INSTITUICAO_SECUNDARIA_LOGO_URL?.trim() || null,
    }
  : null;
