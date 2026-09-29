import type { ReactNode } from "react";
import type { FormularioSolicitacao } from "@/types";
import { MODALIDADE_ROTULO, calcularIdade, formatarDataIso, formatarHora, formatarPeso } from "@/lib/formulario";

/**
 * Layout de impressão GENÉRICO do formulário de solicitação de transfusão:
 * só lista os dados gravados, agrupados por seção. O layout definitivo do
 * papel ainda não foi definido; quando for, troque apenas este componente
 * (ele recebe o registro completo, `dados`, e é usado pelas duas telas de
 * impressão: a pública, por token, e a da agência).
 */

type Linha = [rotulo: string, valor: ReactNode];

const sn = (v: boolean | null | undefined) => (v === null || v === undefined ? "—" : v ? "Sim" : "Não");

function Bloco({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <section className="mb-4 [break-inside:avoid] print:mb-2.5">
      <h2 className="mb-1 border-b border-neutral-400 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-hemo">{titulo}</h2>
      <dl className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12px] leading-snug">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="text-neutral-600">{rotulo}</dt>
            <dd className="whitespace-pre-wrap font-medium text-neutral-900">{valor === null || valor === "" ? "—" : valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FormularioImpressao({ dados }: { dados: FormularioSolicitacao }) {
  const { estabelecimento: est } = dados;
  const endereco = [est.endereco, [est.cidade, est.uf].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const registradoEm = new Date(dados.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const termos = [dados.termo_heterogrupo_medico, dados.termo_heterogrupo_crm, dados.termo_emergencia_medico, dados.termo_emergencia_crm].some(Boolean);

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white px-[10mm] py-[8mm] font-sans text-neutral-900 print:max-w-none print:p-0" aria-label={`Solicitação de transfusão ${dados.protocolo}`}>
      <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-hemo pb-2 print:mb-3">
        <div>
          <h1 className="text-[16px] font-bold uppercase tracking-wide text-hemo">Solicitação de transfusão de hemocomponentes</h1>
          <p className="text-[12px] text-neutral-700">{est.nome}</p>
        </div>
        <div className="shrink-0 text-right text-[11px] text-neutral-600">
          <p>
            Protocolo <strong className="font-mono text-[13px] text-neutral-900">{dados.protocolo}</strong>
          </p>
          <p>Registrado em {registradoEm}</p>
        </div>
      </header>

      <Bloco
        titulo="Estabelecimento solicitante"
        linhas={[
          ["Hospital / unidade de saúde", est.nome],
          ["CNES", est.cnes],
          ["Convênio", dados.convenio],
          ["Endereço", endereco],
        ]}
      />
      <Bloco
        titulo="Paciente"
        linhas={[
          ["Nome", dados.nome_paciente],
          ["Prontuário", dados.prontuario],
          ["Sexo", dados.sexo],
          ["Data de nascimento", `${formatarDataIso(dados.data_nascimento)} (${calcularIdade(dados.data_nascimento, dados.data_solicitacao)})`],
          ["Nome da mãe", dados.nome_mae],
          ["Raça / cor", dados.raca_cor],
          ["Unidade / enfermaria", dados.setor_nome],
          ["Leito", dados.leito],
          ["Peso", formatarPeso(dados.peso_kg)],
          ["Data e horário da solicitação", `${formatarDataIso(dados.data_solicitacao)} às ${formatarHora(dados.hora_solicitacao)}`],
        ]}
      />
      <Bloco
        titulo="Dados clínicos e laboratoriais"
        linhas={[
          ["Diagnóstico", dados.diagnostico],
          ["Hb (g/dL)", dados.hb],
          ["Ht (%)", dados.ht],
          ["Plaquetas (/mm³)", dados.plaquetas],
          ["TP (s)", dados.tp],
          ["TTPA (s)", dados.ttpa],
        ]}
      />
      <Bloco
        titulo="Histórico transfusional e indicação"
        linhas={[
          ["Indicação", dados.indicacao === "USO" ? "Uso" : "Reserva"],
          ["Antecedentes transfusionais", sn(dados.antecedentes_transfusionais)],
          ["Antecedentes obstétricos", dados.sexo === "F" ? sn(dados.antecedentes_obstetricos) : "Não se aplica"],
          ["Reação transfusional prévia", sn(dados.reacao_previa)],
          ...(dados.reacao_previa ? ([["Reação anterior", dados.reacao_previa_descricao]] as Linha[]) : []),
        ]}
      />
      <Bloco
        titulo="Hemocomponentes solicitados"
        linhas={[
          ...dados.itens.map(
            (item, i): Linha => [
              `${i + 1}. ${item.hemocomponente_sigla ?? item.hemocomponente_nome}`,
              [
                `${item.hemocomponente_nome}: ${item.quantidade} ${item.unidade_medida === "ML" ? "mL" : item.quantidade === 1 ? "unidade" : "unidades"}`,
                item.modificacoes.length ? `Modificação: ${item.modificacoes.join(", ")}` : "Sem modificação",
              ].join("\n"),
            ],
          ),
          ["Modalidade", MODALIDADE_ROTULO[dados.modalidade]],
          ["Observações", dados.observacoes],
        ]}
      />
      {termos && (
        <Bloco
          titulo="Termos"
          linhas={[
            ["Transfusão heterogrupo: médico", [dados.termo_heterogrupo_medico, dados.termo_heterogrupo_crm && `CRM ${dados.termo_heterogrupo_crm}`].filter(Boolean).join(" · ") || null],
            ["Emergência: médico", [dados.termo_emergencia_medico, dados.termo_emergencia_crm && `CRM ${dados.termo_emergencia_crm}`].filter(Boolean).join(" · ") || null],
          ]}
        />
      )}
      <Bloco
        titulo="Médico requisitante"
        linhas={[
          ["Nome", dados.medico_nome],
          ["CRM", dados.medico_crm],
        ]}
      />
    </article>
  );
}
