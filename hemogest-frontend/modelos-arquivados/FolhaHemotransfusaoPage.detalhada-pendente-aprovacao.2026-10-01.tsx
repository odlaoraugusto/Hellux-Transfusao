import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * Folha de Hemotransfusão (2026-09-30, pedido do cliente) — emitida entre
 * "processar" e "entregar" uma solicitação, pra acompanhar a bolsa e o
 * cartão de hemocomponente até o setor. Documento interno (sem letterhead
 * oficial pra sobrepor, ao contrário do STH), por isso vira HTML impresso
 * direto pelo navegador em vez de pdf-lib.
 * Checagem dupla: a coluna "Hemoterapia" já sai marcada (quem emitiu a
 * folha já conferiu tudo isso pra poder emitir); a coluna "Setor" fica em
 * branco, preenchida à caneta por quem recebe. A conferência à
 * beira-leito e os sinais vitais são 100% em branco — acontecem depois,
 * na enfermaria.
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
  EMERGENCIA: "Emergência",
  URGENCIA: "Urgente",
  ROTINA: "Rotina",
  PROGRAMADA: "Programada",
};

const PRIORIDADE_PARA_MODALIDADE: Record<string, string> = {
  EMERGENCIA: "EMERGENCIA",
  URGENTE: "URGENCIA",
  ROTINA: "ROTINA",
};

const CHECAGEM_DUPLA: string[] = [
  "Prescrição/solicitação confere com a bolsa",
  "Identificação da bolsa legível e íntegra",
  "Nome completo do receptor conferido",
  "Bolsa íntegra, sem vazamento/violação",
  "Prontuário, nascimento e setor/leito conferidos",
  "Aspecto visual adequado",
  "ABO/RhD do receptor conferido",
  "Temperatura/condição de transporte adequada",
  "Hemocomponente, nº e ABO/RhD da bolsa conferidos",
  "Caixa térmica limpa, íntegra e identificada",
  "Validade, volume e compatibilidade conferidos",
  "Documentação acompanha a bolsa",
];

const CONFERENCIA_BEIRA_LEITO: string[] = [
  "Prescrição vigente + identificação positiva conferidas",
  "Bolsa conferida: nº, ABO/RhD, validade e compatibilidade",
  "Acesso venoso exclusivo e equipo específico disponíveis",
  "SSVV basais aferidos antes da transfusão",
  "Paciente/familiar orientado quando aplicável",
  "Equipe comunicada; observação inicial 10 a 15 min",
];

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-400">
      <h2 className="border-b border-neutral-400 bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide print:bg-neutral-200">
        {titulo}
      </h2>
      <div className="p-1">{children}</div>
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
        <div className="mx-auto max-w-[210mm] space-y-1 bg-white p-2 text-ink shadow-lg print:shadow-none" style={{ fontSize: "10px" }}>
          <div className="flex items-center gap-3 border-2 border-neutral-800 bg-white px-3 py-1">
            <img src="/brand/logo-hospital-joaquim-sampaio.png" alt="Hospital Materno-Infantil Dr. Joaquim Sampaio" className="h-9 w-auto shrink-0" />
            <h1 className="flex-1 text-center text-base font-bold text-neutral-900">FOLHA DE HEMOTRANSFUSÃO</h1>
            <img src="/brand/logo-fesf-sus.png" alt="FESF-SUS" className="h-9 w-auto shrink-0" />
          </div>

          <Secao titulo="Identificação do receptor">
            <p>
              <strong>Receptor:</strong> {item.paciente_nome}
            </p>
            <p>
              <strong>Nome da mãe:</strong> {paciente?.nome_mae ?? "—"}
            </p>
            <p>
              <strong>Prontuário:</strong> {paciente?.numero_prontuario ?? "—"} &nbsp;&nbsp;
              <strong>Sexo:</strong> ({paciente?.sexo === "M" ? "X" : " "}) M &nbsp;({paciente?.sexo === "F" ? "X" : " "}) F
              &nbsp;&nbsp;
              <strong>Nascimento:</strong> {formatarData(paciente?.data_nascimento ?? null)} &nbsp;&nbsp;
              <strong>Setor/Leito:</strong> {item.setor_nome}
              {origem?.leito ? ` / ${origem.leito}` : ""} &nbsp;&nbsp;
              <strong>ABO/RhD:</strong> {item.abo_paciente ?? "—"}
            </p>
          </Secao>

          <Secao titulo="Identificação do hemocomponente">
            <p>
              <strong>Hemocomponente:</strong> {item.hemocomponente_nome} &nbsp;&nbsp;
              <strong>Bolsa {item.bolsas.findIndex((b) => b.id === bolsa.id) + 1} de {item.quantidade} · Nº:</strong> {bolsa.numero_bolsa}{" "}
              &nbsp;&nbsp;
              <strong>ABO/RhD bolsa:</strong> {bolsa.tipo_sanguineo} &nbsp;&nbsp;
              <strong>Volume:</strong> {bolsa.volume_ml ? `${bolsa.volume_ml} mL` : "—"} &nbsp;&nbsp;
              <strong>Validade:</strong> {formatarData(bolsa.data_validade)}
            </p>
            <p className="mt-1">
              <strong>Compatibilidade:</strong> ({bolsa.prova_cruzada === "COMPATIVEL" ? "X" : " "}) Compatível &nbsp;(
              {bolsa.prova_cruzada === "INCOMPATIVEL" ? "X" : " "}) Incompatível* &nbsp;(
              {!bolsa.prova_cruzada || bolsa.prova_cruzada === "NAO_SE_APLICA" ? "X" : " "}) Emergência sem teste*
              {bolsa.liberacao_com_ressalva ? " — liberada com ressalva" : ""}
            </p>
            <p>
              <strong>Responsável testes:</strong> {bolsa.responsavel_testes ?? "—"}
            </p>
            <p className="mt-1">
              <strong>Modalidade:</strong>{" "}
              {(["ROTINA", "URGENCIA", "PROGRAMADA", "EMERGENCIA"] as const)
                .map((m) => `(${modalidade === m ? "X" : " "}) ${MODALIDADE_ROTULO[m]}`)
                .join("  ")}
            </p>
          </Secao>

          <Secao titulo="Checagem dupla para entrega da bolsa">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-400 text-left">
                  <th className="py-0.5 pr-1 text-[9px] font-bold uppercase text-ink-muted">Item de conferência</th>
                  <th className="w-24 py-0.5 px-1 text-center text-[9px] font-bold uppercase text-ink-muted">Hemoterapia</th>
                  <th className="w-24 py-0.5 pl-1 text-center text-[9px] font-bold uppercase text-ink-muted">Setor</th>
                </tr>
              </thead>
              <tbody>
                {CHECAGEM_DUPLA.map((texto) => (
                  <tr key={texto} className="border-b border-neutral-200 last:border-0">
                    <td className="py-0.5 pr-1">{texto}</td>
                    <td className="whitespace-nowrap py-0.5 px-1 text-center font-medium text-ink">(X) Sim ( ) Não</td>
                    <td className="whitespace-nowrap py-0.5 pl-1 text-center">(&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1">
              <strong>Técnico responsável (Hemoterapia):</strong> {bolsa.folha_emitida_por_nome ?? "—"}
            </p>
          </Secao>

          <Secao titulo="Registro de recebimento da bolsa">
            <p>
              <strong>Data:</strong> ____/____/______ &nbsp;&nbsp; <strong>Hora:</strong> ____:____ &nbsp;&nbsp;
              <strong>Temp. caixa:</strong> ______ °C
            </p>
            <p className="mt-1">
              <strong>Entregue por:</strong> {bolsa.folha_emitida_por_nome ?? "—"} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Recebido por:</strong> ________________________
            </p>
          </Secao>

          <Secao titulo="Conferência à beira-leito / pré-instalação">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-400 text-left">
                  <th className="py-0.5 pr-1 text-[9px] font-bold uppercase text-ink-muted">Item de conferência</th>
                  <th className="w-24 py-0.5 pl-1 text-center text-[9px] font-bold uppercase text-ink-muted">Setor</th>
                </tr>
              </thead>
              <tbody>
                {CONFERENCIA_BEIRA_LEITO.map((texto) => (
                  <tr key={texto} className="border-b border-neutral-200 last:border-0">
                    <td className="py-0.5 pr-1">{texto}</td>
                    <td className="whitespace-nowrap py-0.5 pl-1 text-center">(&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>

          <Secao titulo="Registro de sinais vitais durante a transfusão">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-[9px] font-bold uppercase text-ink-muted">
                  <th className="py-0.5">Tempo</th>
                  <th className="py-0.5">PA (mmHg)</th>
                  <th className="py-0.5">FC (bpm)</th>
                  <th className="py-0.5">FR (rpm)</th>
                  <th className="py-0.5">SatO2 (%)</th>
                  <th className="py-0.5">Tax (°C)</th>
                  <th className="py-0.5">Assinatura/registro</th>
                </tr>
              </thead>
              <tbody>
                {["Início", "10 a 30 min", "1 hora", "2 horas", "3 horas", "Término"].map((linha) => (
                  <tr key={linha} className="border-b border-neutral-200 last:border-0">
                    <td className="py-0.5">{linha}</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                    <td className="py-0.5">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>

          <Secao titulo="Observações / impedimentos">
            <p className="text-[9px]">
              Qualquer divergência de identificação, hemocomponente, nº da bolsa, compatibilidade, validade, integridade da
              bolsa ou condição de transporte impede a entrega/instalação até esclarecimento pelo serviço de hemoterapia.
            </p>
            <p className="mt-2 border-b border-neutral-400">&nbsp;</p>
          </Secao>

          <p className="text-center text-[9px] text-ink-muted">
            Documento operacional - Hemotransfusão | Checagem dupla obrigatória na entrega da bolsa | Revisão: 20/05/2026
          </p>
        </div>
      )}
    </div>
  );
}
