import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface AcompanhamentoResumo {
  id: string;
  solicitacao_id: string;
  paciente_nome: string;
  setor_nome: string;
  hemocomponente_nome: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
}

interface AcompanhamentoDetalhe {
  id: string;
  solicitacao_id: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes_finalizacao: string | null;
}

interface BolsaResumo {
  id: string;
  numero_bolsa: string;
  tipo_sanguineo: string;
}

interface SolicitacaoResumo {
  id: string;
  paciente_nome: string;
  setor_nome: string;
  hemocomponente_nome: string;
  hemocomponente_sigla: string | null;
  quantidade: number;
  status: string;
  bolsas_entregues: number;
  bolsas: BolsaResumo[];
}

interface SinalVital {
  id: string;
  momento: string;
  data_hora: string;
  temperatura_c: number | null;
  pressao_arterial: string | null;
  frequencia_cardiaca_bpm: number | null;
  frequencia_respiratoria_ipm: number | null;
  saturacao_o2_pct: number | null;
  observacoes: string | null;
}

interface SinalVitalForm {
  momento: string;
  temperatura_c: string;
  pressao_arterial: string;
  frequencia_cardiaca_bpm: string;
  frequencia_respiratoria_ipm: string;
  saturacao_o2_pct: string;
  observacoes: string;
}

const STATUS_ROTULOS: Record<string, string> = {
  AGUARDANDO: "Aguardando",
  EM_ANDAMENTO: "Em Andamento",
  INTERCORRENCIA: "Intercorrência",
  FINALIZADO: "Finalizado",
};

const MOMENTO_OPCOES: { valor: string; rotulo: string }[] = [
  { valor: "PRE", rotulo: "Pré" },
  { valor: "DEZ_MINUTOS", rotulo: "10 minutos" },
  { valor: "UMA_HORA", rotulo: "1 hora" },
  { valor: "FINAL", rotulo: "Final" },
  { valor: "EXTRA", rotulo: "Extra" },
];

const MOMENTO_ROTULOS: Record<string, string> = Object.fromEntries(MOMENTO_OPCOES.map((o) => [o.valor, o.rotulo]));

const SINAL_VAZIO: SinalVitalForm = {
  momento: "PRE",
  temperatura_c: "",
  pressao_arterial: "",
  frequencia_cardiaca_bpm: "",
  frequencia_respiratoria_ipm: "",
  saturacao_o2_pct: "",
  observacoes: "",
};

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR");
}

/** Abre a partir de uma Solicitação Transfusional já registrada (a
 * solicitação em si vem do formulário público, automaticamente) — não
 * depende de internação nem de bolsa reservada: controle de estoque de
 * bolsas está inativo neste hospital por enquanto (2026-09-30, pedido do
 * cliente). */
export function AcompanhamentosPage() {
  const { unidadeAtivaId } = useAuth();

  const [lista, setLista] = useState<AcompanhamentoResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [todasSolicitacoes, setTodasSolicitacoes] = useState<SolicitacaoResumo[]>([]);
  const solicitacoesAbertas = todasSolicitacoes.filter((s) => s.status === "SOLICITADO" || s.status === "EM_PROCESSAMENTO");

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<AcompanhamentoDetalhe | null>(null);
  const [solicitacaoDetalhe, setSolicitacaoDetalhe] = useState<SolicitacaoResumo | null>(null);
  const [sinaisVitais, setSinaisVitais] = useState<SinalVital[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [formNovoAberto, setFormNovoAberto] = useState(false);
  const [solicitacaoIdNovo, setSolicitacaoIdNovo] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  const [formSinal, setFormSinal] = useState<SinalVitalForm>(SINAL_VAZIO);
  const [salvandoSinal, setSalvandoSinal] = useState(false);
  const [erroSinal, setErroSinal] = useState<string | null>(null);

  const [houveIntercorrencia, setHouveIntercorrencia] = useState(false);
  const [observacoesFinalizacao, setObservacoesFinalizacao] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState<string | null>(null);

  // Horário de início/término manuais (2026-10-05, pedido do cliente: "permitir
  // colocar o horário de início e término da infusão, atualmente pega o
  // horario automaticamente") — em branco mantém o comportamento antigo
  // (servidor usa o horário do momento da ação).
  const [horaInicioManual, setHoraInicioManual] = useState("");
  const [horaFimManual, setHoraFimManual] = useState("");

  function carregarLista() {
    if (!unidadeAtivaId) return;
    setCarregandoLista(true);
    setErroLista(null);
    api
      .get<AcompanhamentoResumo[]>("/relatorios/transfusoes?format=json")
      .then(setLista)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar os acompanhamentos.")))
      .finally(() => setCarregandoLista(false));
  }

  function carregarSolicitacoesAbertas() {
    if (!unidadeAtivaId) return;
    api
      .get<SolicitacaoResumo[]>("/solicitacoes")
      .then(setTodasSolicitacoes)
      .catch(() => setTodasSolicitacoes([]));
  }

  useEffect(() => {
    carregarLista();
    carregarSolicitacoesAbertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  // Solicitações com pelo menos 1 bolsa já entregue mas que ainda não têm
  // nenhum Acompanhamento aberto — fica visível pra equipe não esquecer de
  // abrir o acompanhamento assim que a bolsa chega no setor (2026-10-01,
  // pedido do cliente: não abrir sozinho, só deixar a pendência visível).
  const idsComAcompanhamento = useMemo(() => new Set(lista.map((a) => a.solicitacao_id)), [lista]);
  const pendentes = useMemo(
    () => todasSolicitacoes.filter((s) => s.bolsas_entregues > 0 && !idsComAcompanhamento.has(s.id)),
    [todasSolicitacoes, idsComAcompanhamento],
  );

  function carregarDetalhe(id: string) {
    setCarregandoDetalhe(true);
    setErroDetalhe(null);
    Promise.all([
      api.get<AcompanhamentoDetalhe>(`/acompanhamentos/${id}`),
      api.get<SinalVital[]>(`/acompanhamentos/${id}/sinais-vitais`),
    ])
      .then(([det, sinais]) => {
        setDetalhe(det);
        setSinaisVitais(sinais);
        return api.get<SolicitacaoResumo>(`/solicitacoes/${det.solicitacao_id}`);
      })
      .then(setSolicitacaoDetalhe)
      .catch((err) => setErroDetalhe(mensagemErro(err, "Não foi possível carregar o acompanhamento.")))
      .finally(() => setCarregandoDetalhe(false));
  }

  function abrirDetalhe(id: string) {
    setSelecionadoId(id);
    setErroAcao(null);
    setFormSinal(SINAL_VAZIO);
    setErroSinal(null);
    setHouveIntercorrencia(false);
    setObservacoesFinalizacao("");
    setErroFinalizar(null);
    setHoraInicioManual("");
    setHoraFimManual("");
    carregarDetalhe(id);
  }

  function abrirFormNovo() {
    setFormNovoAberto(true);
    setSolicitacaoIdNovo("");
    setErroNovo(null);
    carregarSolicitacoesAbertas();
  }

  function fecharFormNovo() {
    setFormNovoAberto(false);
    setErroNovo(null);
  }

  async function abrirAcompanhamentoPara(solicitacaoId: string) {
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const criado = await api.post<AcompanhamentoDetalhe>("/acompanhamentos", { solicitacao_id: solicitacaoId });
      fecharFormNovo();
      carregarLista();
      carregarSolicitacoesAbertas();
      abrirDetalhe(criado.id);
    } catch (err) {
      setErroNovo(mensagemErro(err, "Não foi possível abrir o acompanhamento."));
    } finally {
      setSalvandoNovo(false);
    }
  }

  function criarAcompanhamento(e: FormEvent) {
    e.preventDefault();
    if (!solicitacaoIdNovo) return;
    abrirAcompanhamentoPara(solicitacaoIdNovo);
  }

  async function iniciar() {
    if (!selecionadoId) return;
    setProcessandoAcao(true);
    setErroAcao(null);
    try {
      await api.post(`/acompanhamentos/${selecionadoId}/iniciar`, {
        data_inicio: horaInicioManual ? new Date(horaInicioManual).toISOString() : null,
      });
      carregarDetalhe(selecionadoId);
      carregarLista();
    } catch (err) {
      setErroAcao(mensagemErro(err, "Não foi possível iniciar o acompanhamento."));
    } finally {
      setProcessandoAcao(false);
    }
  }

  async function registrarSinalVital(e: FormEvent) {
    e.preventDefault();
    if (!selecionadoId) return;
    setSalvandoSinal(true);
    setErroSinal(null);
    try {
      await api.post(`/acompanhamentos/${selecionadoId}/sinais-vitais`, {
        momento: formSinal.momento,
        temperatura_c: formSinal.temperatura_c ? Number(formSinal.temperatura_c) : null,
        pressao_arterial: formSinal.pressao_arterial || null,
        frequencia_cardiaca_bpm: formSinal.frequencia_cardiaca_bpm ? Number(formSinal.frequencia_cardiaca_bpm) : null,
        frequencia_respiratoria_ipm: formSinal.frequencia_respiratoria_ipm
          ? Number(formSinal.frequencia_respiratoria_ipm)
          : null,
        saturacao_o2_pct: formSinal.saturacao_o2_pct ? Number(formSinal.saturacao_o2_pct) : null,
        observacoes: formSinal.observacoes || null,
      });
      setFormSinal({ ...SINAL_VAZIO, momento: formSinal.momento });
      carregarDetalhe(selecionadoId);
    } catch (err) {
      setErroSinal(mensagemErro(err, "Não foi possível registrar o sinal vital."));
    } finally {
      setSalvandoSinal(false);
    }
  }

  async function finalizar(e: FormEvent) {
    e.preventDefault();
    if (!selecionadoId) return;
    setFinalizando(true);
    setErroFinalizar(null);
    try {
      await api.post(`/acompanhamentos/${selecionadoId}/finalizar`, {
        observacoes_finalizacao: observacoesFinalizacao || null,
        houve_intercorrencia: houveIntercorrencia,
        data_fim: horaFimManual ? new Date(horaFimManual).toISOString() : null,
      });
      setObservacoesFinalizacao("");
      setHouveIntercorrencia(false);
      setHoraFimManual("");
      carregarDetalhe(selecionadoId);
      carregarLista();
    } catch (err) {
      setErroFinalizar(mensagemErro(err, "Não foi possível finalizar o acompanhamento."));
    } finally {
      setFinalizando(false);
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os acompanhamentos.</p>;
  }

  const podeAgir = detalhe?.status === "EM_ANDAMENTO" || detalhe?.status === "INTERCORRENCIA";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Acompanhamento Transfusional</h1>
        <Button onClick={abrirFormNovo} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Acompanhamento
        </Button>
      </div>

      {pendentes.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950">
          <h2 className="mb-1 text-lg font-medium text-amber-900 dark:text-amber-100">
            Pendentes de Acompanhamento ({pendentes.length})
          </h2>
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">
            Já tem bolsa entregue ao setor, mas ainda não tem acompanhamento aberto.
          </p>
          <div className="divide-y divide-amber-200">
            {pendentes.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="text-sm">
                  <div className="font-medium text-ink">{s.paciente_nome}</div>
                  <div className="text-ink-muted">
                    {s.hemocomponente_sigla ?? s.hemocomponente_nome} · {s.setor_nome} · {s.bolsas_entregues}/{s.quantidade} entregues
                  </div>
                </div>
                <Button onClick={() => abrirAcompanhamentoPara(s.id)} disabled={salvandoNovo} className="shrink-0 px-3 py-1.5 text-sm">
                  Abrir Acompanhamento
                </Button>
              </div>
            ))}
          </div>
          {erroNovo && <p className="mt-2 text-sm text-danger">{erroNovo}</p>}
        </Card>
      )}

      {formNovoAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Novo Acompanhamento</h2>
          <form onSubmit={criarAcompanhamento} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Solicitação</label>
              <select
                required
                value={solicitacaoIdNovo}
                onChange={(e) => setSolicitacaoIdNovo(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="">Selecione...</option>
                {solicitacoesAbertas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.paciente_nome} — {s.hemocomponente_sigla ?? s.hemocomponente_nome} ({s.setor_nome})
                  </option>
                ))}
              </select>
              {solicitacoesAbertas.length === 0 && (
                <p className="mt-1 text-xs text-ink-muted">Nenhuma solicitação em aberto (Solicitada ou Em processamento) no momento.</p>
              )}
            </div>

            {erroNovo && <p className="text-sm text-danger">{erroNovo}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={salvandoNovo || !solicitacaoIdNovo}>
                {salvandoNovo ? "Abrindo..." : "Abrir Acompanhamento"}
              </Button>
              <Button type="button" variant="ghost" onClick={fecharFormNovo}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="p-0 lg:col-span-5">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Início</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLista ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Carregando...
                  </td>
                </tr>
              ) : erroLista ? (
                <tr>
                  <td className="px-4 py-6 text-center text-danger" colSpan={3}>
                    {erroLista}
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Nenhum acompanhamento encontrado.
                  </td>
                </tr>
              ) : (
                lista.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => abrirDetalhe(a.id)}
                    className={clsx(
                      "cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50",
                      selecionadoId === a.id && "bg-hemo/5",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div>{a.paciente_nome}</div>
                      <div className="text-xs text-ink-muted">
                        {a.hemocomponente_nome} · {a.setor_nome}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={a.status}>{STATUS_ROTULOS[a.status] ?? a.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatarDataHora(a.data_inicio)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4 lg:col-span-7">
          {!selecionadoId ? (
            <Card>
              <p className="text-ink-muted">Selecione um acompanhamento na lista para ver os detalhes.</p>
            </Card>
          ) : carregandoDetalhe ? (
            <Card>
              <p className="text-ink-muted">Carregando...</p>
            </Card>
          ) : erroDetalhe ? (
            <Card>
              <p className="text-danger">{erroDetalhe}</p>
            </Card>
          ) : detalhe ? (
            <>
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Detalhe do Acompanhamento</h2>
                  <Badge status={detalhe.status}>{STATUS_ROTULOS[detalhe.status] ?? detalhe.status}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Paciente</dt>
                    <dd>{solicitacaoDetalhe?.paciente_nome ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Setor</dt>
                    <dd>{solicitacaoDetalhe?.setor_nome ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Hemocomponente</dt>
                    <dd>
                      {solicitacaoDetalhe
                        ? `${solicitacaoDetalhe.hemocomponente_sigla ?? solicitacaoDetalhe.hemocomponente_nome} × ${solicitacaoDetalhe.quantidade}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-ink-muted">Bolsa(s)</dt>
                    <dd>
                      {solicitacaoDetalhe && solicitacaoDetalhe.bolsas.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {solicitacaoDetalhe.bolsas.map((b) => (
                            <span
                              key={b.id}
                              className="rounded-full bg-hemo/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-hemo"
                            >
                              {b.numero_bolsa} · {b.tipo_sanguineo}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Início</dt>
                    <dd>{formatarDataHora(detalhe.data_inicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Fim</dt>
                    <dd>{formatarDataHora(detalhe.data_fim)}</dd>
                  </div>
                  {detalhe.observacoes_finalizacao && (
                    <div className="sm:col-span-2">
                      <dt className="text-ink-muted">Observações de Finalização</dt>
                      <dd>{detalhe.observacoes_finalizacao}</dd>
                    </div>
                  )}
                </dl>

                {erroAcao && <p className="mt-3 text-sm text-danger">{erroAcao}</p>}

                {detalhe.status === "AGUARDANDO" && (
                  <div className="mt-4 space-y-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Horário de início (opcional — em branco usa o horário atual)
                      </label>
                      <input
                        type="datetime-local"
                        value={horaInicioManual}
                        onChange={(e) => setHoraInicioManual(e.target.value)}
                        className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <Button onClick={iniciar} disabled={processandoAcao}>
                      {processandoAcao ? "Iniciando..." : "Iniciar Acompanhamento"}
                    </Button>
                  </div>
                )}
              </Card>

              <Card className="p-0">
                <h3 className="px-4 pt-4 text-base font-medium">Sinais Vitais</h3>
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 text-left text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Momento</th>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Temp.</th>
                      <th className="px-4 py-3 font-medium">PA</th>
                      <th className="px-4 py-3 font-medium">FC</th>
                      <th className="px-4 py-3 font-medium">FR</th>
                      <th className="px-4 py-3 font-medium">SpO2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sinaisVitais.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-ink-muted" colSpan={7}>
                          Nenhum sinal vital registrado.
                        </td>
                      </tr>
                    ) : (
                      sinaisVitais.map((s) => (
                        <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                          <td className="px-4 py-3">{MOMENTO_ROTULOS[s.momento] ?? s.momento}</td>
                          <td className="px-4 py-3">{formatarDataHora(s.data_hora)}</td>
                          <td className="px-4 py-3">{s.temperatura_c ?? "—"}</td>
                          <td className="px-4 py-3">{s.pressao_arterial ?? "—"}</td>
                          <td className="px-4 py-3">{s.frequencia_cardiaca_bpm ?? "—"}</td>
                          <td className="px-4 py-3">{s.frequencia_respiratoria_ipm ?? "—"}</td>
                          <td className="px-4 py-3">{s.saturacao_o2_pct ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>

              {podeAgir && (
                <Card>
                  <h3 className="mb-4 text-base font-medium">Registrar Sinal Vital</h3>
                  <form onSubmit={registrarSinalVital} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Momento</label>
                      <select
                        required
                        value={formSinal.momento}
                        onChange={(e) => setFormSinal({ ...formSinal, momento: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      >
                        {MOMENTO_OPCOES.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Temperatura (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={30}
                        max={45}
                        value={formSinal.temperatura_c}
                        onChange={(e) => setFormSinal({ ...formSinal, temperatura_c: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Pressão Arterial</label>
                      <input
                        placeholder="120/80"
                        maxLength={15}
                        value={formSinal.pressao_arterial}
                        onChange={(e) => setFormSinal({ ...formSinal, pressao_arterial: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">FC (bpm)</label>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={formSinal.frequencia_cardiaca_bpm}
                        onChange={(e) => setFormSinal({ ...formSinal, frequencia_cardiaca_bpm: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">FR (ipm)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formSinal.frequencia_respiratoria_ipm}
                        onChange={(e) => setFormSinal({ ...formSinal, frequencia_respiratoria_ipm: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">SpO2 (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formSinal.saturacao_o2_pct}
                        onChange={(e) => setFormSinal({ ...formSinal, saturacao_o2_pct: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-sm font-medium">Observações (opcional)</label>
                      <textarea
                        rows={2}
                        value={formSinal.observacoes}
                        onChange={(e) => setFormSinal({ ...formSinal, observacoes: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>

                    {erroSinal && <p className="text-sm text-danger sm:col-span-3">{erroSinal}</p>}

                    <div className="sm:col-span-3">
                      <Button type="submit" disabled={salvandoSinal}>
                        {salvandoSinal ? "Registrando..." : "Registrar Sinal Vital"}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {podeAgir && (
                <Card>
                  <h3 className="mb-4 text-base font-medium">Finalizar Acompanhamento</h3>
                  <form onSubmit={finalizar} className="space-y-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={houveIntercorrencia}
                        onChange={(e) => setHouveIntercorrencia(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      Houve intercorrência
                    </label>
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Horário de término (opcional — em branco usa o horário atual)
                      </label>
                      <input
                        type="datetime-local"
                        value={horaFimManual}
                        onChange={(e) => setHoraFimManual(e.target.value)}
                        className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Observações de Finalização (opcional)</label>
                      <textarea
                        rows={3}
                        value={observacoesFinalizacao}
                        onChange={(e) => setObservacoesFinalizacao(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>

                    {erroFinalizar && <p className="text-sm text-danger">{erroFinalizar}</p>}

                    <Button type="submit" disabled={finalizando}>
                      {finalizando ? "Finalizando..." : "Finalizar Acompanhamento"}
                    </Button>
                  </form>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
