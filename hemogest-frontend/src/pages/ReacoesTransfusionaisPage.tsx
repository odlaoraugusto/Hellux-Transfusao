import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Paciente } from "@/types";

interface ReacaoResumo {
  id: string;
  status: string;
  tipo_reacao_id: string;
  gravidade_id: string;
  data_abertura: string;
  notivisa_numero: string | null;
}

interface ReacaoDetalhe extends ReacaoResumo {
  acompanhamento_id: string;
  descricao: string;
  investigacao: string | null;
  notivisa_data_envio: string | null;
  conclusao: string | null;
  data_encerramento: string | null;
}

interface ParametrizacaoItem {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

interface AcompanhamentoResumo {
  id: string;
  internacao_id: string;
  unidade_hemocomponente_id: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
}

interface InternacaoResumo {
  id: string;
  paciente_id: string;
  numero_internacao: string | null;
  data_entrada: string;
  data_alta: string | null;
  status: string;
}

interface Bolsa {
  id: string;
  numero_bolsa: string;
  status: string;
}

const STATUS_ROTULOS: Record<string, string> = {
  ABERTA: "Aberta",
  INVESTIGACAO: "Em Investigação",
  NOTIVISA: "Notificada (Notivisa)",
  ENCERRADA: "Encerrada",
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

export function ReacoesTransfusionaisPage() {
  const { unidadeAtivaId } = useAuth();

  const [lista, setLista] = useState<ReacaoResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [tipos, setTipos] = useState<ParametrizacaoItem[]>([]);
  const [gravidades, setGravidades] = useState<ParametrizacaoItem[]>([]);

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [internacoes, setInternacoes] = useState<InternacaoResumo[]>([]);
  const [bolsas, setBolsas] = useState<Bolsa[]>([]);
  const [acompanhamentos, setAcompanhamentos] = useState<AcompanhamentoResumo[]>([]);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ReacaoDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  const [formNovoAberto, setFormNovoAberto] = useState(false);
  const [acompanhamentoIdNovo, setAcompanhamentoIdNovo] = useState("");
  const [tipoIdNovo, setTipoIdNovo] = useState("");
  const [gravidadeIdNovo, setGravidadeIdNovo] = useState("");
  const [descricaoNovo, setDescricaoNovo] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  const [investigacao, setInvestigacao] = useState("");
  const [salvandoInvestigacao, setSalvandoInvestigacao] = useState(false);
  const [erroInvestigacao, setErroInvestigacao] = useState<string | null>(null);

  const [notivisaNumero, setNotivisaNumero] = useState("");
  const [salvandoNotivisa, setSalvandoNotivisa] = useState(false);
  const [erroNotivisa, setErroNotivisa] = useState<string | null>(null);

  const [conclusao, setConclusao] = useState("");
  const [salvandoEncerrar, setSalvandoEncerrar] = useState(false);
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null);

  const mapaTipos = useMemo(() => {
    const mapa = new Map<string, string>();
    tipos.forEach((t) => mapa.set(t.id, t.nome));
    return mapa;
  }, [tipos]);

  const mapaGravidades = useMemo(() => {
    const mapa = new Map<string, string>();
    gravidades.forEach((g) => mapa.set(g.id, g.nome));
    return mapa;
  }, [gravidades]);

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

  const mapaAcompanhamentos = useMemo(() => {
    const mapa = new Map<string, AcompanhamentoResumo>();
    acompanhamentos.forEach((a) => mapa.set(a.id, a));
    return mapa;
  }, [acompanhamentos]);

  const acompanhamentosEmAndamento = useMemo(
    () => acompanhamentos.filter((a) => a.status === "EM_ANDAMENTO"),
    [acompanhamentos],
  );

  function nomeAcompanhamento(acompanhamentoId: string): string {
    const acompanhamento = mapaAcompanhamentos.get(acompanhamentoId);
    if (!acompanhamento) return "—";
    const internacao = mapaInternacoes.get(acompanhamento.internacao_id);
    const paciente = internacao ? mapaPacientes.get(internacao.paciente_id) : null;
    const bolsa = mapaBolsas.get(acompanhamento.unidade_hemocomponente_id)?.numero_bolsa;
    const partes = [paciente ?? "Paciente não identificado", bolsa ? `bolsa ${bolsa}` : null].filter(Boolean);
    return partes.join(" — ");
  }

  function carregarLista() {
    if (!unidadeAtivaId) return;
    setCarregandoLista(true);
    setErroLista(null);
    api
      .get<ReacaoResumo[]>("/relatorios/reacoes?format=json")
      .then(setLista)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar as reações transfusionais.")))
      .finally(() => setCarregandoLista(false));
  }

  function carregarCadastros() {
    if (!unidadeAtivaId) return;
    api
      .get<ParametrizacaoItem[]>("/tipos-reacao")
      .then(setTipos)
      .catch(() => setTipos([]));
    api
      .get<ParametrizacaoItem[]>("/gravidades")
      .then(setGravidades)
      .catch(() => setGravidades([]));
    Promise.all([
      api.get<Paciente[]>("/pacientes?limit=200"),
      api.get<InternacaoResumo[]>("/relatorios/internacoes?format=json"),
      api.get<Bolsa[]>("/hemocomponentes-bolsas?limit=200"),
      api.get<AcompanhamentoResumo[]>("/relatorios/transfusoes?format=json"),
    ])
      .then(([listaPacientes, listaInternacoes, listaBolsas, listaAcompanhamentos]) => {
        setPacientes(listaPacientes);
        setInternacoes(listaInternacoes);
        setBolsas(listaBolsas);
        setAcompanhamentos(listaAcompanhamentos);
      })
      .catch(() => {
        setPacientes([]);
        setInternacoes([]);
        setBolsas([]);
        setAcompanhamentos([]);
      });
  }

  useEffect(() => {
    carregarLista();
    carregarCadastros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  function carregarDetalhe(id: string) {
    setCarregandoDetalhe(true);
    setErroDetalhe(null);
    api
      .get<ReacaoDetalhe>(`/reacoes-transfusionais/${id}`)
      .then(setDetalhe)
      .catch((err) => setErroDetalhe(mensagemErro(err, "Não foi possível carregar a reação transfusional.")))
      .finally(() => setCarregandoDetalhe(false));
  }

  function abrirDetalhe(id: string) {
    setSelecionadoId(id);
    setInvestigacao("");
    setErroInvestigacao(null);
    setNotivisaNumero("");
    setErroNotivisa(null);
    setConclusao("");
    setErroEncerrar(null);
    carregarDetalhe(id);
  }

  function abrirFormNovo() {
    setFormNovoAberto(true);
    setAcompanhamentoIdNovo("");
    setTipoIdNovo("");
    setGravidadeIdNovo("");
    setDescricaoNovo("");
    setErroNovo(null);
  }

  function fecharFormNovo() {
    setFormNovoAberto(false);
    setErroNovo(null);
  }

  async function criarReacao(e: FormEvent) {
    e.preventDefault();
    if (!acompanhamentoIdNovo || !tipoIdNovo || !gravidadeIdNovo || descricaoNovo.trim().length < 5) return;
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const criada = await api.post<ReacaoDetalhe>("/reacoes-transfusionais", {
        acompanhamento_id: acompanhamentoIdNovo,
        tipo_reacao_id: tipoIdNovo,
        gravidade_id: gravidadeIdNovo,
        descricao: descricaoNovo,
      });
      fecharFormNovo();
      carregarLista();
      abrirDetalhe(criada.id);
    } catch (err) {
      setErroNovo(mensagemErro(err, "Não foi possível abrir a reação transfusional."));
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function investigar(e: FormEvent) {
    e.preventDefault();
    if (!selecionadoId || investigacao.trim().length < 5) return;
    setSalvandoInvestigacao(true);
    setErroInvestigacao(null);
    try {
      await api.post(`/reacoes-transfusionais/${selecionadoId}/investigar`, { investigacao });
      carregarDetalhe(selecionadoId);
      carregarLista();
    } catch (err) {
      setErroInvestigacao(mensagemErro(err, "Não foi possível registrar a investigação."));
    } finally {
      setSalvandoInvestigacao(false);
    }
  }

  async function notificarNotivisa(e: FormEvent) {
    e.preventDefault();
    if (!selecionadoId || !notivisaNumero.trim()) return;
    setSalvandoNotivisa(true);
    setErroNotivisa(null);
    try {
      await api.post(`/reacoes-transfusionais/${selecionadoId}/notivisa`, { notivisa_numero: notivisaNumero });
      carregarDetalhe(selecionadoId);
      carregarLista();
    } catch (err) {
      setErroNotivisa(mensagemErro(err, "Não foi possível registrar a notificação Notivisa."));
    } finally {
      setSalvandoNotivisa(false);
    }
  }

  async function encerrar(e: FormEvent) {
    e.preventDefault();
    if (!selecionadoId || conclusao.trim().length < 5) return;
    setSalvandoEncerrar(true);
    setErroEncerrar(null);
    try {
      await api.post(`/reacoes-transfusionais/${selecionadoId}/encerrar`, { conclusao });
      carregarDetalhe(selecionadoId);
      carregarLista();
    } catch (err) {
      setErroEncerrar(mensagemErro(err, "Não foi possível encerrar a reação transfusional."));
    } finally {
      setSalvandoEncerrar(false);
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver as reações transfusionais.</p>;
  }

  const podeInvestigar = detalhe?.status === "ABERTA" || detalhe?.status === "INVESTIGACAO";
  const podeNotivisa = detalhe?.status === "INVESTIGACAO";
  const podeEncerrar = detalhe?.status === "INVESTIGACAO" || detalhe?.status === "NOTIVISA";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reações Transfusionais</h1>
        <Button onClick={abrirFormNovo} className="flex items-center gap-2">
          <Plus size={16} />
          Nova Reação
        </Button>
      </div>

      {formNovoAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Nova Reação Transfusional</h2>
          <form onSubmit={criarReacao} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Acompanhamento em Andamento</label>
              <select
                required
                value={acompanhamentoIdNovo}
                onChange={(e) => setAcompanhamentoIdNovo(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="">Selecione...</option>
                {acompanhamentosEmAndamento.map((a) => (
                  <option key={a.id} value={a.id}>
                    {nomeAcompanhamento(a.id)}
                  </option>
                ))}
              </select>
              {acompanhamentosEmAndamento.length === 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  Nenhum acompanhamento em andamento no momento. Inicie um acompanhamento transfusional antes de
                  abrir uma reação.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo de Reação</label>
                <select
                  required
                  value={tipoIdNovo}
                  onChange={(e) => setTipoIdNovo(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gravidade</label>
                <select
                  required
                  value={gravidadeIdNovo}
                  onChange={(e) => setGravidadeIdNovo(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {gravidades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={descricaoNovo}
                onChange={(e) => setDescricaoNovo(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>

            {erroNovo && <p className="text-sm text-danger">{erroNovo}</p>}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={
                  salvandoNovo || !acompanhamentoIdNovo || !tipoIdNovo || !gravidadeIdNovo || descricaoNovo.trim().length < 5
                }
              >
                {salvandoNovo ? "Abrindo..." : "Abrir Reação"}
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
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Gravidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Abertura</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLista ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : erroLista ? (
                <tr>
                  <td className="px-4 py-6 text-center text-danger" colSpan={4}>
                    {erroLista}
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                    Nenhuma reação transfusional encontrada.
                  </td>
                </tr>
              ) : (
                lista.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => abrirDetalhe(r.id)}
                    className={clsx(
                      "cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50",
                      selecionadoId === r.id && "bg-hemo/5",
                    )}
                  >
                    <td className="px-4 py-3">{mapaTipos.get(r.tipo_reacao_id) ?? "—"}</td>
                    <td className="px-4 py-3">{mapaGravidades.get(r.gravidade_id) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge status={r.status}>{STATUS_ROTULOS[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatarDataHora(r.data_abertura)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4 lg:col-span-7">
          {!selecionadoId ? (
            <Card>
              <p className="text-ink-muted">Selecione uma reação na lista para ver os detalhes.</p>
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
                  <h2 className="text-lg font-medium">Detalhe da Reação</h2>
                  <Badge status={detalhe.status}>{STATUS_ROTULOS[detalhe.status] ?? detalhe.status}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Acompanhamento</dt>
                    <dd>{nomeAcompanhamento(detalhe.acompanhamento_id)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Tipo</dt>
                    <dd>{mapaTipos.get(detalhe.tipo_reacao_id) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Gravidade</dt>
                    <dd>{mapaGravidades.get(detalhe.gravidade_id) ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Abertura</dt>
                    <dd>{formatarDataHora(detalhe.data_abertura)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-ink-muted">Descrição</dt>
                    <dd>{detalhe.descricao}</dd>
                  </div>
                  {detalhe.investigacao && (
                    <div className="sm:col-span-2">
                      <dt className="text-ink-muted">Investigação</dt>
                      <dd>{detalhe.investigacao}</dd>
                    </div>
                  )}
                  {detalhe.notivisa_numero && (
                    <div>
                      <dt className="text-ink-muted">Notivisa</dt>
                      <dd>
                        {detalhe.notivisa_numero} ({formatarDataHora(detalhe.notivisa_data_envio)})
                      </dd>
                    </div>
                  )}
                  {detalhe.conclusao && (
                    <div className="sm:col-span-2">
                      <dt className="text-ink-muted">Conclusão</dt>
                      <dd>{detalhe.conclusao}</dd>
                    </div>
                  )}
                  {detalhe.data_encerramento && (
                    <div>
                      <dt className="text-ink-muted">Encerramento</dt>
                      <dd>{formatarDataHora(detalhe.data_encerramento)}</dd>
                    </div>
                  )}
                </dl>
              </Card>

              {podeInvestigar && (
                <Card>
                  <h3 className="mb-4 text-base font-medium">Investigar</h3>
                  <form onSubmit={investigar} className="space-y-4">
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      placeholder="Descreva a investigação realizada..."
                      value={investigacao}
                      onChange={(e) => setInvestigacao(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                    />
                    {erroInvestigacao && <p className="text-sm text-danger">{erroInvestigacao}</p>}
                    <Button type="submit" disabled={salvandoInvestigacao || investigacao.trim().length < 5}>
                      {salvandoInvestigacao ? "Salvando..." : "Registrar Investigação"}
                    </Button>
                  </form>
                </Card>
              )}

              {podeNotivisa && (
                <Card>
                  <h3 className="mb-4 text-base font-medium">Notificar Notivisa</h3>
                  <form onSubmit={notificarNotivisa} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Número Notivisa</label>
                      <input
                        required
                        maxLength={50}
                        value={notivisaNumero}
                        onChange={(e) => setNotivisaNumero(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                      />
                    </div>
                    {erroNotivisa && <p className="text-sm text-danger">{erroNotivisa}</p>}
                    <Button type="submit" disabled={salvandoNotivisa || !notivisaNumero.trim()}>
                      {salvandoNotivisa ? "Salvando..." : "Registrar Notivisa"}
                    </Button>
                  </form>
                </Card>
              )}

              {podeEncerrar && (
                <Card>
                  <h3 className="mb-4 text-base font-medium">Encerrar Reação</h3>
                  <form onSubmit={encerrar} className="space-y-4">
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      placeholder="Conclusão do caso..."
                      value={conclusao}
                      onChange={(e) => setConclusao(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                    />
                    {erroEncerrar && <p className="text-sm text-danger">{erroEncerrar}</p>}
                    <Button type="submit" disabled={salvandoEncerrar || conclusao.trim().length < 5}>
                      {salvandoEncerrar ? "Encerrando..." : "Encerrar Reação"}
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
