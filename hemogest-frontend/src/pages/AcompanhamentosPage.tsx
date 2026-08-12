import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Paciente } from "@/types";

interface AcompanhamentoResumo {
  id: string;
  internacao_id: string;
  unidade_hemocomponente_id: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
}

interface AcompanhamentoDetalhe extends AcompanhamentoResumo {
  observacoes_finalizacao: string | null;
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

interface Bolsa {
  id: string;
  numero_bolsa: string;
  status: string;
  paciente_reservado_id: string | null;
}

interface InternacaoResumo {
  id: string;
  paciente_id: string;
  numero_internacao: string | null;
  data_entrada: string;
  data_alta: string | null;
  status: string;
}

interface Setor {
  id: string;
  nome: string;
  sigla: string | null;
  ativo: boolean;
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

interface InternacaoForm {
  paciente_id: string;
  setor_id: string;
  numero_internacao: string;
  leito: string;
  data_entrada: string;
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

const INTERNACAO_VAZIA: InternacaoForm = {
  paciente_id: "",
  setor_id: "",
  numero_internacao: "",
  leito: "",
  data_entrada: "",
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

export function AcompanhamentosPage() {
  const { unidadeAtivaId } = useAuth();

  const [lista, setLista] = useState<AcompanhamentoResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [internacoes, setInternacoes] = useState<InternacaoResumo[]>([]);
  const [bolsas, setBolsas] = useState<Bolsa[]>([]);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<AcompanhamentoDetalhe | null>(null);
  const [sinaisVitais, setSinaisVitais] = useState<SinalVital[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [formNovoAberto, setFormNovoAberto] = useState(false);
  const [internacaoIdNovo, setInternacaoIdNovo] = useState("");
  const [bolsaIdNovo, setBolsaIdNovo] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  const [novaInternacaoAberta, setNovaInternacaoAberta] = useState(false);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [formInternacao, setFormInternacao] = useState<InternacaoForm>(INTERNACAO_VAZIA);
  const [salvandoInternacao, setSalvandoInternacao] = useState(false);
  const [erroInternacao, setErroInternacao] = useState<string | null>(null);

  const [formSinal, setFormSinal] = useState<SinalVitalForm>(SINAL_VAZIO);
  const [salvandoSinal, setSalvandoSinal] = useState(false);
  const [erroSinal, setErroSinal] = useState<string | null>(null);

  const [houveIntercorrencia, setHouveIntercorrencia] = useState(false);
  const [observacoesFinalizacao, setObservacoesFinalizacao] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState<string | null>(null);

  const mapaPacientes = useMemo(() => {
    const mapa = new Map<string, string>();
    pacientes.forEach((p) => mapa.set(p.id, p.nome));
    return mapa;
  }, [pacientes]);

  const mapaInternacoes = useMemo(() => {
    const mapa = new Map<string, InternacaoResumo>();
    internacoes.forEach((i) => mapa.set(i.id, i));
    return mapa;
  }, [internacoes]);

  const mapaBolsas = useMemo(() => {
    const mapa = new Map<string, Bolsa>();
    bolsas.forEach((b) => mapa.set(b.id, b));
    return mapa;
  }, [bolsas]);

  const internacoesAtivas = useMemo(() => internacoes.filter((i) => !i.data_alta), [internacoes]);
  const bolsasReservadas = useMemo(() => bolsas.filter((b) => b.status === "RESERVADO"), [bolsas]);

  function nomeInternacao(internacaoId: string): string {
    const internacao = mapaInternacoes.get(internacaoId);
    if (!internacao) return "—";
    const paciente = mapaPacientes.get(internacao.paciente_id) ?? "Paciente não identificado";
    return internacao.numero_internacao ? `${paciente} — ${internacao.numero_internacao}` : paciente;
  }

  function nomeBolsa(bolsaId: string): string {
    return mapaBolsas.get(bolsaId)?.numero_bolsa ?? "—";
  }

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

  function carregarCadastros() {
    if (!unidadeAtivaId) return;
    Promise.all([
      api.get<Paciente[]>("/pacientes?limit=200"),
      api.get<InternacaoResumo[]>("/relatorios/internacoes?format=json"),
      api.get<Bolsa[]>("/hemocomponentes-bolsas?limit=200"),
    ])
      .then(([listaPacientes, listaInternacoes, listaBolsas]) => {
        setPacientes(listaPacientes);
        setInternacoes(listaInternacoes);
        setBolsas(listaBolsas);
      })
      .catch(() => {
        setPacientes([]);
        setInternacoes([]);
        setBolsas([]);
      });
  }

  useEffect(() => {
    carregarLista();
    carregarCadastros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  useEffect(() => {
    if (!novaInternacaoAberta || setores.length > 0) return;
    api
      .get<Setor[]>("/setores")
      .then(setSetores)
      .catch(() => setSetores([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaInternacaoAberta]);

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
      })
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
    carregarDetalhe(id);
  }

  function abrirFormNovo() {
    setFormNovoAberto(true);
    setInternacaoIdNovo("");
    setBolsaIdNovo("");
    setErroNovo(null);
    setNovaInternacaoAberta(false);
    setFormInternacao(INTERNACAO_VAZIA);
    setErroInternacao(null);
  }

  function fecharFormNovo() {
    setFormNovoAberto(false);
    setErroNovo(null);
    setNovaInternacaoAberta(false);
    setErroInternacao(null);
  }

  async function criarAcompanhamento(e: FormEvent) {
    e.preventDefault();
    if (!internacaoIdNovo || !bolsaIdNovo) return;
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const criado = await api.post<AcompanhamentoDetalhe>("/acompanhamentos", {
        internacao_id: internacaoIdNovo,
        unidade_hemocomponente_id: bolsaIdNovo,
      });
      fecharFormNovo();
      carregarLista();
      abrirDetalhe(criado.id);
    } catch (err) {
      setErroNovo(mensagemErro(err, "Não foi possível abrir o acompanhamento."));
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function criarInternacao() {
    if (!formInternacao.paciente_id || !formInternacao.setor_id || !formInternacao.data_entrada) {
      setErroInternacao("Preencha paciente, setor e data de entrada.");
      return;
    }
    setSalvandoInternacao(true);
    setErroInternacao(null);
    try {
      const nova = await api.post<InternacaoResumo>("/internacoes", {
        paciente_id: formInternacao.paciente_id,
        setor_id: formInternacao.setor_id,
        numero_internacao: formInternacao.numero_internacao || null,
        leito: formInternacao.leito || null,
        data_entrada: formInternacao.data_entrada,
      });
      setInternacoes((prev) => [...prev, nova]);
      setInternacaoIdNovo(nova.id);
      setNovaInternacaoAberta(false);
      setFormInternacao(INTERNACAO_VAZIA);
    } catch (err) {
      setErroInternacao(mensagemErro(err, "Não foi possível cadastrar a internação."));
    } finally {
      setSalvandoInternacao(false);
    }
  }

  async function iniciar() {
    if (!selecionadoId) return;
    setProcessandoAcao(true);
    setErroAcao(null);
    try {
      await api.post(`/acompanhamentos/${selecionadoId}/iniciar`);
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
      });
      setObservacoesFinalizacao("");
      setHouveIntercorrencia(false);
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

      {formNovoAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Novo Acompanhamento</h2>
          <form onSubmit={criarAcompanhamento} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Internação Ativa</label>
                <select
                  required
                  value={internacaoIdNovo}
                  onChange={(e) => setInternacaoIdNovo(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {internacoesAtivas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {mapaPacientes.get(i.paciente_id) ?? "Paciente não identificado"}
                      {i.numero_internacao ? ` — ${i.numero_internacao}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bolsa Reservada</label>
                <select
                  required
                  value={bolsaIdNovo}
                  onChange={(e) => setBolsaIdNovo(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {bolsasReservadas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.numero_bolsa}
                      {b.paciente_reservado_id
                        ? ` — ${mapaPacientes.get(b.paciente_reservado_id) ?? "paciente reservado"}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {erroNovo && <p className="text-sm text-danger">{erroNovo}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={salvandoNovo || !internacaoIdNovo || !bolsaIdNovo}>
                {salvandoNovo ? "Abrindo..." : "Abrir Acompanhamento"}
              </Button>
              <Button type="button" variant="ghost" onClick={fecharFormNovo}>
                Cancelar
              </Button>
            </div>
          </form>

          {internacoesAtivas.length === 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-neutral-300 p-4">
              <p className="text-sm text-ink-muted">
                Nenhuma internação ativa encontrada.{" "}
                <button
                  type="button"
                  onClick={() => setNovaInternacaoAberta((v) => !v)}
                  className="font-medium text-hemo hover:underline"
                >
                  Cadastrar nova internação
                </button>
              </p>

              {novaInternacaoAberta && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Paciente</label>
                      <select
                        value={formInternacao.paciente_id}
                        onChange={(e) => setFormInternacao({ ...formInternacao, paciente_id: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {pacientes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Setor</label>
                      <select
                        value={formInternacao.setor_id}
                        onChange={(e) => setFormInternacao({ ...formInternacao, setor_id: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {setores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Número da Internação (opcional)</label>
                      <input
                        maxLength={30}
                        value={formInternacao.numero_internacao}
                        onChange={(e) => setFormInternacao({ ...formInternacao, numero_internacao: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Leito (opcional)</label>
                      <input
                        maxLength={20}
                        value={formInternacao.leito}
                        onChange={(e) => setFormInternacao({ ...formInternacao, leito: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Data de Entrada</label>
                      <input
                        type="date"
                        value={formInternacao.data_entrada}
                        onChange={(e) => setFormInternacao({ ...formInternacao, data_entrada: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                  </div>

                  {erroInternacao && <p className="text-sm text-danger">{erroInternacao}</p>}

                  <Button type="button" onClick={criarInternacao} disabled={salvandoInternacao}>
                    {salvandoInternacao ? "Cadastrando..." : "Cadastrar Internação"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="p-0 lg:col-span-5">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Internação</th>
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
                    <td className="px-4 py-3">{nomeInternacao(a.internacao_id)}</td>
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
                    <dt className="text-ink-muted">Internação</dt>
                    <dd>{nomeInternacao(detalhe.internacao_id)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Bolsa</dt>
                    <dd>{nomeBolsa(detalhe.unidade_hemocomponente_id)}</dd>
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
                  <div className="mt-4">
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
