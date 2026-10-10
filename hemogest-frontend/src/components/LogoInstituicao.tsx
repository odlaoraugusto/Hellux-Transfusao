import type { IdentidadeInstitucional } from "@/config/instituicao";

interface LogoInstituicaoProps {
  instituicao: IdentidadeInstitucional;
  className?: string;
}

/**
 * Mostra a logo configurada para a instituição (ver src/config/instituicao.ts);
 * sem logo configurada, cai num selo de texto com o nome em vez de exibir a
 * logo de uma instituição real como padrão.
 */
export function LogoInstituicao({ instituicao, className }: LogoInstituicaoProps) {
  if (instituicao.logoUrl) {
    return <img src={instituicao.logoUrl} alt={instituicao.nome} className={className} />;
  }
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded bg-white/90 px-2 text-center text-[10px] font-semibold leading-tight text-neutral-700 ${className ?? ""}`}
    >
      {instituicao.nome}
    </span>
  );
}
