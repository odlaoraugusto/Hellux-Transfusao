import type { ReactNode } from "react";
import clsx from "clsx";
import type { FormularioSolicitacao } from "@/types";
import { MODALIDADES, MODIFICACOES, calcularIdade, formatarDataIso, formatarHora, formatarPeso } from "@/lib/formulario";

/**
 * Documento do formulário de solicitação de transfusão, montado para
 * impressão em uma folha A4 (retrato). É só leitura de propósito: mostra o
 * que foi gravado, com as caixas de carimbo e assinatura em branco para
 * serem preenchidas no papel. Cores fixas (não seguem o tema escuro) para
 * o papel sair igual em qualquer tela.
 */

const COR_EXATA = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as const;

function Secao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("relative mb-2.5 rounded-md border border-hemo/60 px-2.5 pb-2 pt-3.5 [break-inside:avoid] print:mb-[7px] print:pb-1.5 print:pt-3", className)}>
      <h2
        style={COR_EXATA}
        className="absolute -top-[9px] left-3 rounded-[3px] bg-hemo px-2 py-[1px] text-[9px] font-bold uppercase tracking-wide text-white"
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ rotulo, children, className }: { rotulo: string; children?: ReactNode; className?: string }) {
  const vazio = children === null || children === undefined || children === "";
  return (
    <div className={className}>
      <span className="block text-[8px] font-semibold uppercase tracking-wide text-hemo">{rotulo}</span>
      <div className="min-h-[19px] whitespace-pre-wrap rounded border border-neutral-300 px-1.5 py-[2px] text-[10.5px] leading-snug print:min-h-[17px] print:py-0 text-neutral-900">
        {vazio ? <span className="text-neutral-400">—</span> : children}
      </div>
    </div>
  );
}

function Marca({ marcada, rotulo, dica }: { marcada: boolean; rotulo: string; dica?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-900">
      <span
        style={COR_EXATA}
        aria-hidden="true"
        className={clsx(
          "inline-flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-[2px] border text-[8px] font-bold leading-none",
          marcada ? "border-hemo bg-hemo text-white" : "border-neutral-600 bg-white",
        )}
      >
        {marcada ? "✕" : ""}
      </span>
      <span className={marcada ? "font-semibold" : ""}>{rotulo}</span>
      {dica && <span className="text-[8px] text-neutral-500">({dica})</span>}
      <span className="sr-only">{marcada ? "marcado" : "não marcado"}</span>
    </span>
  );
}

function Opcao({ rotulo, valor, sim = "Sim", nao = "Não" }: { rotulo: string; valor: boolean | null; sim?: string; nao?: string }) {
  return (
    <div>
      <span className="block text-[8px] font-semibold uppercase tracking-wide text-hemo">{rotulo}</span>
      <div className="flex min-h-[19px] items-center gap-3">
        <Marca marcada={valor === true} rotulo={sim} />
        <Marca marcada={valor === false} rotulo={nao} />
      </div>
    </div>
  );
}

function Carimbo({ altura, rotulo = "Carimbo e assinatura" }: { altura: string; rotulo?: string }) {
  return (
    <div
      className={clsx(
        "flex items-end justify-center rounded border border-dashed border-neutral-400 pb-1 text-[8px] font-semibold uppercase text-neutral-400",
        altura,
      )}
    >
      {rotulo}
    </div>
  );
}

export function FormularioImpressao({ dados }: { dados: FormularioSolicitacao }) {
  const { estabelecimento: est } = dados;
  const enderecoCompleto = [est.endereco, [est.cidade, est.uf].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const registradoEm = new Date(dados.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <article
      style={COR_EXATA}
      className="mx-auto w-full max-w-[210mm] bg-white px-[6mm] py-[5mm] font-sans text-neutral-900 print:max-w-none print:p-0"
      aria-label={`Formulário de solicitação de transfusão ${dados.protocolo}`}
    >
      <header className="mb-3 flex items-center gap-3 border-b-[3px] border-hemo pb-2 print:mb-2.5 print:pb-1.5">
        <img src="/brand/hemogest-simbolo.svg" alt="" className="h-11 w-11 shrink-0 print:h-9 print:w-9" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold uppercase leading-tight tracking-wide text-hemo">
            Solicitação de Transfusão de Hemocomponentes
          </h1>
          <p className="text-[10px] text-neutral-600">{est.nome}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[8px] font-semibold uppercase tracking-wide text-hemo">Protocolo</span>
          <span className="block font-mono text-[13px] font-bold leading-tight">{dados.protocolo}</span>
          <span className="block text-[8px] text-neutral-500">Registrado em {registradoEm}</span>
        </div>
      </header>

      <Secao titulo="Dados do estabelecimento solicitante">
        <div className="grid grid-cols-12 gap-x-2 gap-y-1.5">
          <Campo className="col-span-7" rotulo="Hospital / Unidade de saúde">{est.nome}</Campo>
          <Campo className="col-span-2" rotulo="CNES">{est.cnes}</Campo>
          <Campo className="col-span-3" rotulo="Convênio">{dados.convenio}</Campo>
          <Campo className="col-span-12" rotulo="Endereço">{enderecoCompleto}</Campo>
        </div>
      </Secao>

      <Secao titulo="Dados de identificação do paciente">
        <div className="grid grid-cols-12 gap-x-2 gap-y-1.5">
          <Campo className="col-span-6" rotulo="Nome completo do paciente">{dados.nome_paciente}</Campo>
          <Campo className="col-span-2" rotulo="Nº prontuário">{dados.prontuario}</Campo>
          <Campo className="col-span-1" rotulo="Sexo">{dados.sexo}</Campo>
          <Campo className="col-span-3" rotulo="Data de nascimento">{formatarDataIso(dados.data_nascimento)}</Campo>
          <Campo className="col-span-6" rotulo="Nome da mãe (genitora)">{dados.nome_mae}</Campo>
          <Campo className="col-span-3" rotulo="Idade">{calcularIdade(dados.data_nascimento, dados.data_solicitacao)}</Campo>
          <Campo className="col-span-3" rotulo="Raça / Cor">{dados.raca_cor}</Campo>
          <Campo className="col-span-4" rotulo="Unidade / Enfermaria">{dados.setor_nome}</Campo>
          <Campo className="col-span-2" rotulo="Leito">{dados.leito}</Campo>
          <Campo className="col-span-2" rotulo="Peso">{formatarPeso(dados.peso_kg)}</Campo>
          <Campo className="col-span-2" rotulo="Data solicit.">{formatarDataIso(dados.data_solicitacao)}</Campo>
          <Campo className="col-span-2" rotulo="Horário">{formatarHora(dados.hora_solicitacao)}</Campo>
        </div>
      </Secao>

      <Secao titulo="Dados clínicos e laboratoriais">
        <div className="grid grid-cols-10 gap-x-2 gap-y-1.5">
          <Campo className="col-span-10" rotulo="Diagnóstico">{dados.diagnostico}</Campo>
          <Campo className="col-span-2" rotulo="Hb (g/dL)">{dados.hb}</Campo>
          <Campo className="col-span-2" rotulo="Ht (%)">{dados.ht}</Campo>
          <Campo className="col-span-2" rotulo="Plaquetas (/mm³)">{dados.plaquetas}</Campo>
          <Campo className="col-span-2" rotulo="TP (s)">{dados.tp}</Campo>
          <Campo className="col-span-2" rotulo="TTPA (s)">{dados.ttpa}</Campo>
        </div>
      </Secao>

      <Secao titulo="Histórico transfusional e indicação">
        <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
          <div>
            <span className="block text-[8px] font-semibold uppercase tracking-wide text-hemo">Indicação</span>
            <div className="flex min-h-[19px] items-center gap-3">
              <Marca marcada={dados.indicacao === "USO"} rotulo="Uso" />
              <Marca marcada={dados.indicacao === "RESERVA"} rotulo="Reserva" />
            </div>
          </div>
          <Opcao rotulo="Antecedentes transfusionais" valor={dados.antecedentes_transfusionais} />
          {dados.sexo === "F" ? (
            <Opcao rotulo="Antecedentes obstétricos" valor={dados.antecedentes_obstetricos} />
          ) : (
            <Campo rotulo="Antecedentes obstétricos">Não se aplica</Campo>
          )}
          <Opcao rotulo="Reação transfusional prévia" valor={dados.reacao_previa} />
          {dados.reacao_previa && <Campo className="col-span-4" rotulo="Reação transfusional anterior">{dados.reacao_previa_descricao}</Campo>}
        </div>
      </Secao>

      <Secao titulo="Especificação de hemocomponente(s) e modificação">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-left text-[8px] uppercase tracking-wide text-hemo">
              <th className="w-[34%] border-b-2 border-hemo/50 py-1 pr-2 font-semibold">Hemocomponente solicitado</th>
              <th className="w-[16%] border-b-2 border-hemo/50 py-1 pr-2 font-semibold">Quant. / Vol.</th>
              <th className="border-b-2 border-hemo/50 py-1 font-semibold">Processo de modificação</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-1 pr-2 font-medium">
                  {item.hemocomponente_nome}
                  {item.hemocomponente_sigla ? <span className="text-neutral-500"> ({item.hemocomponente_sigla})</span> : null}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {item.quantidade} {item.unidade_medida === "ML" ? "mL" : item.quantidade === 1 ? "unidade" : "unidades"}
                </td>
                <td className="py-1">
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {MODIFICACOES.map((m) => (
                      <Marca key={m} marcada={item.modificacoes.includes(m)} rotulo={m} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 border-t border-neutral-200 pt-1.5">
          <span className="block text-[8px] font-semibold uppercase tracking-wide text-hemo">Modalidade da transfusão</span>
          <div className="mt-0.5 flex flex-wrap gap-x-5 gap-y-1">
            {MODALIDADES.map((m) => (
              <Marca key={m.valor} marcada={dados.modalidade === m.valor} rotulo={m.rotulo} dica={m.dica} />
            ))}
          </div>
        </div>
      </Secao>

      <Secao titulo="Observações complementares">
        <Campo rotulo="Informações clínicas complementares" className="[&>div]:min-h-[30px] print:[&>div]:min-h-[24px]">
          {dados.observacoes}
        </Campo>
      </Secao>

      <Secao titulo="Termos de responsabilidade e consentimento">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-dashed border-hemo/50 p-1.5">
            <h3 className="mb-0.5 border-l-[3px] border-hemo pl-1.5 text-[8.5px] font-bold uppercase text-hemo">Termo — Transfusão heterogrupo</h3>
            <p className="mb-1.5 text-justify text-[8.5px] leading-snug text-neutral-700">
              Autorizo a transfusão de hemocomponentes heterogrupo compatível para o(a) paciente identificado acima, seguindo as diretrizes
              de segurança imuno-hematológica vigentes.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <Campo className="col-span-2" rotulo="Médico">{dados.termo_heterogrupo_medico}</Campo>
              <Campo rotulo="CRM">{dados.termo_heterogrupo_crm}</Campo>
              <div className="col-span-3">
                <Carimbo altura="h-[48px] print:h-[38px]" />
              </div>
            </div>
          </div>
          <div className="rounded border border-dashed border-hemo/50 p-1.5">
            <h3 className="mb-0.5 border-l-[3px] border-hemo pl-1.5 text-[8.5px] font-bold uppercase text-hemo">Termo — Emergência</h3>
            <p className="mb-1.5 text-justify text-[8.5px] leading-snug text-neutral-700">
              Autorizo ao serviço de hemoterapia o fornecimento de concentrado de hemácias (CH) em caráter de emergência para o(a) paciente
              identificado acima antes da conclusão dos testes pré-transfusionais, ciente de que o retardo acarreta risco à vida do(a)
              mesmo(a). Conforme legislação vigente, afirmo conhecer o risco de tal procedimento e concordo com a autorização do mesmo.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <Campo className="col-span-2" rotulo="Médico">{dados.termo_emergencia_medico}</Campo>
              <Campo rotulo="CRM">{dados.termo_emergencia_crm}</Campo>
              <div className="col-span-3">
                <Carimbo altura="h-[48px] print:h-[38px]" />
              </div>
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Assinatura do médico requisitante">
        <div className="grid grid-cols-3 items-end gap-2">
          <div className="col-span-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
            <Campo className="col-span-3" rotulo="Nome completo do médico solicitante">{dados.medico_nome}</Campo>
            <Campo className="col-span-3" rotulo="CRM">{dados.medico_crm}</Campo>
          </div>
          <Carimbo altura="h-[62px] print:h-[50px]" />
        </div>
      </Secao>

      <footer className="mt-1 text-center text-[8px] text-neutral-500">
        Hellux — Módulo de Transfusão · Protocolo {dados.protocolo} · Carimbo e assinatura feitos no papel impresso.
      </footer>
    </article>
  );
}
