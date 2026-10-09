import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * Folha de Hemotransfusão (2026-10-01, pedido do cliente: modelo oficial
 * atual, mais enxuto que o anterior — ver modelos-arquivados/ na raiz do
 * projeto pro modelo anterior, que ainda está em aprovação e pode voltar
 * a ser usado). Emitida por bolsa, entre "processar" e "entregar" uma
 * solicitação, pra acompanhar a bolsa até o setor. Documento interno (sem
 * letterhead oficial pra sobrepor), por isso vira HTML impresso direto
 * pelo navegador em vez de pdf-lib. Os itens "antes de iniciar a
 * transfusão" e "reação transfusional" são só texto de referência/checagem
 * manual — não vêm de dado nenhum do sistema, são preenchidos à caneta.
 */

interface BolsaEntregue {
  id: string;
  numero_bolsa: string;
  tipo_sanguineo: string;
  data_validade: string;
  volume_ml: number | null;
  prova_cruzada: string | null;
  liberacao_com_ressalva: boolean;
  responsavel_testes: string | null;
  folha_emitida_em: string;
  folha_emitida_por_nome: string | null;
}

interface Solicitacao {
  id: string;
  formulario_solicitacao_id: string | null;
  paciente_id: string;
  paciente_nome: string;
  setor_nome: string;
  hemocomponente_nome: string;
  quantidade: number;
  prioridade: "ROTINA" | "URGENTE" | "EMERGENCIA";
  abo_paciente: string | null;
  pesquisa_anticorpos_irregulares: string | null;
  bolsas: BolsaEntregue[];
}

interface Paciente {
  nome: string;
  data_nascimento: string | null;
  sexo: string | null;
  numero_prontuario: string | null;
  nome_mae: string | null;
}

interface FormularioOrigem {
  leito: string | null;
  modalidade: string;
}

const MODALIDADE_ROTULO: Record<string, string> = {
  EMERGENCIA: "Emergência (bolsa sem teste uso imediato)",
  URGENCIA: "Urgente (até 3h para uso)",
  ROTINA: "Rotina (até 24h para uso)",
  PROGRAMADA: "Programada",
};

const PAI_ROTULO: Record<string, string> = {
  NEGATIVA: "Negativa",
  POSITIVA: "Positiva",
  NAO_REALIZADA: "Não realizada",
};

const PRIORIDADE_PARA_MODALIDADE: Record<string, string> = {
  EMERGENCIA: "EMERGENCIA",
  URGENTE: "URGENCIA",
  ROTINA: "ROTINA",
};

const ANTES_DE_TRANSFUNDIR: string[] = [
  "Transfundir somente com prescrição médica",
  "Identificar adequadamente o receptor (conferir nome do receptor na bolsa + pulseira de identificação)",
  "Conferir rótulo da bolsa (ABO/Rh, compatibilidade, volume, validade)",
  "Verificar SSVV",
  "Utilizar equipo específico para transfusão",
  "Utilizar acesso venoso pérvio e com boa vazão exclusivo para a Hemotransfusão (não infundir soluções não isotônicas e medicações)",
  "Só perfurar a bolsa após conclusão das etapas acima",
  "Fazer assepsia do conector, instalar e controlar o gotejamento",
  "Observar o Paciente por 10 a 15min.",
  "Checar e comunicar a equipe que o paciente está sob transfusão",
  "Informar o serviço de hemoterapia sobre qualquer efeito adverso imediato.",
];

const TEMPO_INFUSAO_POR_LINHA: Record<string, string> = {
  Início: "Concentrado de hemácias: 2 a 4h",
  "10 a 30min": "Concentrado de hemácias: 2 a 4h",
  "1 hora": "Concentrado de plaquetas: 7 a 10 min · Em RN: 10 a 30 min",
  "2 horas": "Concentrado de plaquetas: 7 a 10 min · Em RN: 10 a 30 min",
  "3 horas": "Plasma Fresco congelado e aférese: 40 a 60 min",
  Término: "Crioprecipitado: corre rápido",
};

const SINTOMAS_REACAO: string[] = [
  "Febre", "Hipertensão", "Taquicardia", "Icterícia",
  "Urticária", "Hemoglobinúria", "Cianose", "Dispneia",
  "Tremores", "Calafrios", "Náusea/vômitos",
];

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-400">
      <h2 className="border-b border-neutral-400 bg-neutral-200 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide print:bg-neutral-200">
        {titulo}
      </h2>
      <div className="space-y-1 p-1.5">{children}</div>
    </section>
  );
}

export function FolhaHemotransfusaoPage() {
  const { id, bolsaId } = useParams();
  const [item, setItem] = useState<Solicitacao | null>(null);
  const [bolsa, setBolsa] = useState<BolsaEntregue | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [origem, setOrigem] = useState<FormularioOrigem | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Solicitacao>(`/solicitacoes/${id}`)
      .then((s) => {
        const b = s.bolsas.find((x) => x.id === bolsaId);
        if (!b) {
          setErro("Essa bolsa não foi encontrada nesta solicitação.");
          return;
        }
        setItem(s);
        setBolsa(b);
        document.title = `Folha de Hemotransfusão — ${s.paciente_nome}`;
        api.get<Paciente>(`/pacientes/${s.paciente_id}`).then(setPaciente).catch(() => undefined);
        if (s.formulario_solicitacao_id) {
          api.get<FormularioOrigem>(`/formularios-solicitacao/${s.formulario_solicitacao_id}`).then(setOrigem).catch(() => undefined);
        }
      })
      .catch((err) =>
        setErro(err instanceof ApiError && err.status === 404 ? "Solicitação não encontrada." : "Não foi possível abrir a folha."),
      );
  }, [id, bolsaId]);

  const modalidade = origem?.modalidade ?? PRIORIDADE_PARA_MODALIDADE[item?.prioridade ?? "ROTINA"];

  return (
    <div className="min-h-screen bg-neutral-200 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center gap-2 print:hidden">
        <Link to="/solicitacoes" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-white/60">
          <ArrowLeft size={16} /> Solicitações
        </Link>
        <div className="flex-1" />
        <Button onClick={() => window.print()} disabled={!item} className="flex items-center gap-2">
          <Printer size={16} />
          Imprimir
        </Button>
      </div>

      {erro && <p className="mx-auto max-w-[210mm] rounded-lg bg-white p-4 text-danger">{erro}</p>}
      {!erro && !item && <p className="mx-auto max-w-[210mm] text-neutral-600">Carregando...</p>}

      {item && bolsa && (
        <div className="mx-auto max-w-[210mm] space-y-1.5 bg-white p-2 text-ink shadow-lg print:shadow-none" style={{ fontSize: "11px" }}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-2 border-neutral-800 bg-white px-3 py-1">
            {/* Colunas laterais com a mesma largura (1fr) — centraliza o
             * título de verdade, mesmo as duas logos tendo larguras
             * diferentes (2026-10-01, pedido do cliente: alinhamento do
             * cabeçalho). */}
            <img
              src="/brand/logo-hospital-joaquim-sampaio.png"
              alt="Hospital Materno-Infantil Dr. Joaquim Sampaio"
              className="h-9 w-auto shrink-0 justify-self-start"
            />
            <h1 className="whitespace-nowrap text-center text-base font-bold text-neutral-900">FOLHA DE HEMOTRANSFUSÃO</h1>
            <img src="/brand/logo-fesf-sus.png" alt="FESF-SUS" className="h-9 w-auto shrink-0 justify-self-end" />
          </div>

          <Secao titulo="Identificação">
            <p>
              <strong>Receptor:</strong> {item.paciente_nome}
            </p>
            <p>
              <strong>Nº Prontuário:</strong> {paciente?.numero_prontuario ?? "—"} &nbsp;&nbsp;
              <strong>Sexo:</strong> ({paciente?.sexo === "M" ? "X" : " "}) M &nbsp;({paciente?.sexo === "F" ? "X" : " "}) F
              &nbsp;&nbsp;
              <strong>Idade/Data do Nascimento:</strong> {formatarData(paciente?.data_nascimento ?? null)}
            </p>
            <p>
              <strong>Setor:</strong> {item.setor_nome}
              {origem?.leito ? ` / Leito ${origem.leito}` : ""} &nbsp;&nbsp;
              <strong>ABO/RhD do Receptor:</strong> {item.abo_paciente ?? "—"} &nbsp;&nbsp;
              <strong>PAI:</strong> {item.pesquisa_anticorpos_irregulares ? PAI_ROTULO[item.pesquisa_anticorpos_irregulares] : "—"}
            </p>
            <p>
              <strong>Nome da mãe:</strong> {paciente?.nome_mae ?? "—"}
            </p>
          </Secao>

          <Secao titulo="Identificação da bolsa">
            <p>
              <strong>Hemocomponente:</strong> {item.hemocomponente_nome} &nbsp;&nbsp;
              <strong>Número da bolsa</strong> ({item.bolsas.findIndex((b) => b.id === bolsa.id) + 1} de {item.quantidade})
              : {bolsa.numero_bolsa}
            </p>
            <p>
              <strong>ABO/RHD da bolsa:</strong> {bolsa.tipo_sanguineo} &nbsp;&nbsp;
              <strong>Volume:</strong> {bolsa.volume_ml ? `${bolsa.volume_ml} ml` : "—"} &nbsp;&nbsp;
              <strong>Data Validade:</strong> {formatarData(bolsa.data_validade)}
            </p>
          </Secao>

          <Secao titulo="Teste de compatibilidade">
            <p>
              ({bolsa.prova_cruzada === "COMPATIVEL" ? "X" : " "}) Compatível &nbsp;&nbsp;(
              {bolsa.prova_cruzada === "INCOMPATIVEL" ? "X" : " "}) Incompatível* &nbsp;&nbsp;(
              {!bolsa.prova_cruzada || bolsa.prova_cruzada === "NAO_SE_APLICA" ? "X" : " "}) Emergência* (sem teste de
              compatibilidade)
              {bolsa.liberacao_com_ressalva ? " — liberada com ressalva" : ""}
            </p>
            <p className="text-[9.5px] text-ink-muted">*Transfusão autorizada pelo médico responsável.</p>
            <p>
              <strong>Responsável pelos Testes:</strong> {bolsa.responsavel_testes ?? "—"}
            </p>
          </Secao>

          <Secao titulo="Modalidade de transfusão">
            <p>
              {(["ROTINA", "URGENCIA", "PROGRAMADA", "EMERGENCIA"] as const)
                .map((m) => `(${modalidade === m ? "X" : " "}) ${MODALIDADE_ROTULO[m]}`)
                .join("    ")}
            </p>
            <p className="mt-1">
              <strong>Data da transfusão:</strong> ____/____/______ &nbsp;&nbsp;
              <strong>Horário (início):</strong> ____:____ &nbsp;&nbsp;
              <strong>Horário (término):</strong> ____:____
            </p>
            <p className="mt-1">
              <strong>Responsável pela infusão (enfermagem):</strong> ________________________________
            </p>
          </Secao>

          <Secao titulo="Antes de iniciar a transfusão verifique">
            <ol className="list-inside list-decimal space-y-0.5 text-[9.5px]">
              {ANTES_DE_TRANSFUNDIR.map((texto) => (
                <li key={texto}>{texto}</li>
              ))}
            </ol>
          </Secao>

          <Secao titulo="Dados vitais na transfusão">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-[9.5px] font-bold uppercase text-ink-muted">
                  <th className="py-0.5">Tempo</th>
                  <th className="py-0.5">PA (mmHg)</th>
                  <th className="py-0.5">FC (bpm)</th>
                  <th className="py-0.5">FR (rpm)</th>
                  <th className="py-0.5">SatO2 (%)</th>
                  <th className="py-0.5">Tax (°C)</th>
                  <th className="py-0.5">Tempo indicado para infusão</th>
                </tr>
              </thead>
              <tbody>
                {["Início", "10 a 30min", "1 hora", "2 horas", "3 horas", "Término"].map((linha) => (
                  <tr key={linha} className="border-b border-neutral-200 last:border-0">
                    <td className="py-0.5">{linha}</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5 text-[8.5px] text-ink-muted">{TEMPO_INFUSAO_POR_LINHA[linha]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>

          <Secao titulo="Reação transfusional">
            <p>
              {SINTOMAS_REACAO.map((s) => `(  ) ${s}`).join("   ")} &nbsp;&nbsp;(  ) Outros ___________________
            </p>
            <p className="mt-1 text-[9.5px] text-ink-muted">
              OBS: Em caso de reação transfusional — 1) SUSPENDER IMEDIATAMENTE a infusão e comunicar ao médico; 2) Manter AVP
              pérvio com solução salina; 3) Verificar SSVV; 4) Manter equipo e bolsa intactos e encaminhar ao Banco de Sangue.
            </p>
          </Secao>

          <Secao titulo="Observações">
            <p className="border-b border-neutral-400 pb-2">&nbsp;</p>
          </Secao>
        </div>
      )}
    </div>
  );
}
