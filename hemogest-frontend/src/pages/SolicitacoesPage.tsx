import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BellRing, BellOff, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { alertaSonoroAtivo, definirAlertaSonoro, desbloquearAudio, tocarAlerta } from "@/lib/alertaSonoro";
import type { Paciente } from "@/types";

type StatusSolicitacao = "SOLICITADO" | "EM_PROCESSAMENTO" | "ENTREGUE";

interface BolsaEntregue {
  id: string;
  numero_bolsa: string;
  codigo_satelite: string | null;
  tipo_sanguineo: string | null;
  data_validade: string;
}

interface Solicitacao {
  id: string;
  internacao_id: string;
  paciente_id: string;
  paciente_nome: string;
  setor_solicitante_id: string;
  setor_nome: string;
  hemocomponente_id: string;
  hemocomponente_nome: string;
  hemocomponente_sigla: string | null;
  quantidade: number;
  prioridade: "ROTINA" | "URGENTE" | "EMERGENCIA";
  indicacao: string | null;
  medico_solicitante: string | null;
  status: StatusSolicitacao;
  data_solicitacao: string;
  data_inicio_processamento: string | null;
  data_entrega: string | null;
  abo_paciente: string | null;
  prova_cruzada: string | null;
  temperatura_transporte_c: number | null;
  recebido_por: string | null;
  liberacao_com_ressalva: boolean | null;
  observacoes_entrega: string | null;
  bolsas: BolsaEntregue[];
}

interface Setor {
  id: string;
  nome: string;
}

interface Hemocomponente {
  id: string;
  nome: string;
  sigla: string | null;
  ativo: boolean;
}

interface BolsaDisponivel {
  id: string;
  numero_bolsa: string;
  codigo_satelite: string | null;
  tipo_sanguineo: string | null;
  data_validade: string;
}

interface InternacaoResumo {
  id: string;
  paciente_id: string;
  numero_internacao: string | null;
  data_alta: string | null;
}

const STATUS_ORDEM: StatusSolicitacao[] = ["SOLICITADO", "EM_PROCESSAMENTO", "ENTREGUE"];

const STATUS_INFO: Record<StatusSolicitacao, { rotulo: string; topo: string; linha: string; contador: string }> = {
  SOLICITADO: {
    rotulo: "Solicitado",
    topo: "border-t-amber-500",
    linha: "border-l-amber-500",
    contador: "bg-amber-100 text-amber-800",
  },
  EM_PROCESSAMENTO: {
    rotulo: "Em processamento",
    topo: "border-t-blue-600",
    linha: "border-l-blue-600",
    contador: "bg-blue-100 text-blue-800",
  },
  ENTREGUE: {
    rotulo: "Entregue ao setor",
    topo: "border-t-success",
    linha: "border-l-success",
    contador: "bg-success/10 text-success",
  },
};

const PRIORIDADE_ROTULO: Record<Solicitacao["prioridade"], string> = {
  ROTINA: "Rotina",
  URGENTE: "Urgente",
  EMERGENCIA: "Emergência",
};

const TIPOS_SANGUINEOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const INTERVALO_ATUALIZACAO_MS = 20_000;

const campo =
  "w-full rounded-lg border border-neutral-300 bg-surface-card px-3 py-2 text-sm focus:border-hemo focus:outline-none";

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function deslocarDia(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const data = new Date(a, m - 1, d + n);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** Início e fim do dia no fuso do navegador, em ISO (UTC) para a API. */
function intervaloDoDia(dia: string): { de: string; ate: string } {
  const [a, m, d] = dia.split("-").map(Number);
  return { de: new Date(a, m - 1, d).toISOString(), ate: new Date(a, m - 1, d + 1).toISOString() };
}

function formatarData(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function formatarHora(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function rotuloBolsa(b: { numero_bolsa: string; codigo_satelite: string | null }): string {
  return b.codigo_satelite ? `${b.numero_bolsa}-${b.codigo_satelite}` : b.numero_bolsa;
}

export function SolicitacoesPage() {
  const { unidadeAtivaId } = useAuth();

  const [dia, setDia] = useState(hojeLocal);
  const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | "">("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroHemo, setFiltroHemo] = useState("");
  const [busca, setBusca] = useState("");

  const [lista, setLista] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const [setores, setSetores] = useState<Setor[]>([]);
  const [hemocomponentes, setHemocomponentes] = useState<Hemocomponente[]>([]);

  const [somAtivo, setSomAtivo] = useState(alertaSonoroAtivo);
  const [audioLiberado, setAudioLiberado] = useState(false);
  const [aviso, setAviso] = useState<Solicitacao[]>([]);

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  // Solicitações já vistas no dia — só as que aparecerem depois disparam alerta.
  const vistasRef = useRef<{ dia: string; ids: Set<string> } | null>(null);

  const ehHoje = dia === hojeLocal();

  function carregar(silencioso = false) {
    if (!unidadeAtivaId) return;
    if (!silencioso) setCarregando(true);
    const { de, ate } = intervaloDoDia(dia);
    api
      .get<Solicitacao[]>(`/solicitacoes?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
      .then((itens) => {
        setLista(itens);
        setErro(null);
        setAtualizadoEm(new Date());
        const vistas = vistasRef.current;
        if (!vistas || vistas.dia !== dia) {
          vistasRef.current = { dia, ids: new Set(itens.map((i) => i.id)) };
          return;
        }
        const novas = itens.filter((i) => !vistas.ids.has(i.id) && i.status === "SOLICITADO");
        itens.forEach((i) => vistas.ids.add(i.id));
        if (novas.length) {
          setAviso(novas);
          tocarAlerta(novas.some((n) => n.prioridade === "EMERGENCIA"));
        }
      })
      .catch((err) => {
        if (!silencioso) setErro(mensagemErro(err, "Não foi possível carregar as solicitações."));
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    if (!ehHoje) return;
    const timer = window.setInterval(() => carregar(true), INTERVALO_ATUALIZACAO_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId, dia]);

  useEffect(() => {
    if (!unidadeAtivaId) return;
    Promise.all([api.get<Setor[]>("/setores"), api.get<Hemocomponente[]>("/hemocomponentes")])
      .then(([s, h]) => {
        setSetores(s);
        setHemocomponentes(h.filter((x) => x.ativo));
      })
      .catch(() => undefined);
  }, [unidadeAtivaId]);

  // Tenta liberar o áudio no primeiro clique em qualquer lugar da página.
  useEffect(() => {
    if (audioLiberado) return;
    const liberar = () => desbloquearAudio().then(setAudioLiberado);
    window.addEventListener("pointerdown", liberar, { once: true });
    return () => window.removeEventListener("pointerdown", liberar);
  }, [audioLiberado]);

  async function alternarSom() {
    const novo = !somAtivo;
    setSomAtivo(novo);
    definirAlertaSonoro(novo);
    if (novo) {
      const ok = await desbloquearAudio();
      setAudioLiberado(ok);
      if (ok) tocarAlerta(false);
    }
  }

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter(
      (s) =>
        (!filtroSetor || s.setor_solicitante_id === filtroSetor) &&
        (!filtroHemo || s.hemocomponente_id === filtroHemo) &&
        (!termo || s.paciente_nome.toLowerCase().includes(termo)),
    );
  }, [lista, filtroSetor, filtroHemo, busca]);

  const contagem = useMemo(() => {
    const c: Record<StatusSolicitacao, number> = { SOLICITADO: 0, EM_PROCESSAMENTO: 0, ENTREGUE: 0 };
    filtrada.forEach((s) => c[s.status]++);
    return c;
  }, [filtrada]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver as solicitações.</p>;
  }

  const statusVisiveis = filtroStatus ? [filtroStatus] : STATUS_ORDEM;
  const tituloDia = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Painel de Solicitações</h1>
          <p className="text-sm text-ink-muted">Pedidos de hemocomponente, da solicitação à entrega no setor.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={alternarSom}
            className="flex items-center gap-2"
            title={somAtivo ? "Desligar alerta sonoro" : "Ligar alerta sonoro"}
          >
            {somAtivo ? <BellRing size={16} /> : <BellOff size={16} />}
            {somAtivo ? "Som ligado" : "Som desligado"}
          </Button>
          <Button onClick={() => setNovaAberta(true)} className="flex items-center gap-2">
            <Plus size={16} />
            Nova Solicitação
          </Button>
        </div>
      </div>

      {somAtivo && !audioLiberado && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
          Clique em qualquer ponto da página para o navegador liberar o alerta sonoro.
        </p>
      )}

      {aviso.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <BellRing size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {aviso.length === 1 ? "Nova solicitação recebida" : `${aviso.length} novas solicitações recebidas`}
            </p>
            {aviso.map((s) => (
              <p key={s.id}>
                {s.paciente_nome} · {s.setor_nome} · {formatarHora(s.data_solicitacao)}
                {s.prioridade === "EMERGENCIA" && <strong className="ml-1 text-danger">Emergência</strong>}
              </p>
            ))}
          </div>
          <button type="button" onClick={() => setAviso([])} aria-label="Fechar aviso" className="text-amber-900">
            <X size={16} />
          </button>
        </div>
      )}

      <Card className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Dia</label>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setDia(deslocarDia(dia, -1))} className="rounded-lg border border-neutral-300 p-2" aria-label="Dia anterior">
              <ChevronLeft size={16} />
            </button>
            <input type="date" value={dia} max={hojeLocal()} onChange={(e) => e.target.value && setDia(e.target.value)} className={clsx(campo, "w-40")} />
            <button
              type="button"
              onClick={() => setDia(deslocarDia(dia, 1))}
              disabled={ehHoje}
              className="rounded-lg border border-neutral-300 p-2 disabled:opacity-40"
              aria-label="Próximo dia"
            >
              <ChevronRight size={16} />
            </button>
            {!ehHoje && (
              <Button variant="ghost" onClick={() => setDia(hojeLocal())}>
                Hoje
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusSolicitacao | "")} className={campo}>
            <option value="">Todos</option>
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {STATUS_INFO[s].rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Setor solicitante</label>
          <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className={campo}>
            <option value="">Todos os setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Hemocomponente</label>
          <select value={filtroHemo} onChange={(e) => setFiltroHemo(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {hemocomponentes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.sigla ? `${h.sigla} · ${h.nome}` : h.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-medium">Buscar paciente</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do paciente" className={campo} />
        </div>
      </Card>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          {ehHoje ? "Hoje, " : ""}
          {tituloDia}
        </h2>
        <span className="text-sm text-ink-muted">
          {ehHoje && atualizadoEm
            ? `Atualiza a cada ${INTERVALO_ATUALIZACAO_MS / 1000} s · última às ${atualizadoEm.toLocaleTimeString("pt-BR")}`
            : `${filtrada.length} solicitações`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATUS_ORDEM.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltroStatus(filtroStatus === s ? "" : s)}
            aria-pressed={filtroStatus === s}
            className={clsx(
              "rounded-card border border-l-4 border-neutral-200 bg-surface-card px-4 py-3 text-left shadow-sm",
              STATUS_INFO[s].linha,
              filtroStatus === s && "ring-2 ring-hemo",
            )}
          >
            <span className="block text-sm text-ink-muted">{STATUS_INFO[s].rotulo}</span>
            <span className="text-2xl font-semibold tabular-nums">{contagem[s]}</span>
          </button>
        ))}
      </div>

      {carregando && <p className="text-ink-muted">Carregando solicitações...</p>}
      {erro && <p className="text-danger">{erro}</p>}

      {!carregando &&
        !erro &&
        statusVisiveis.map((s) => {
          const itens = filtrada
            .filter((i) => i.status === s)
            .sort((a, b) =>
              s === "ENTREGUE"
                ? b.data_solicitacao.localeCompare(a.data_solicitacao)
                : a.data_solicitacao.localeCompare(b.data_solicitacao),
            );
          return (
            <section key={s} className={clsx("overflow-hidden rounded-card border border-t-4 border-neutral-200 bg-surface-card shadow-sm", STATUS_INFO[s].topo)}>
              <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
                <h3 className="font-medium">{STATUS_INFO[s].rotulo}</h3>
                <span className={clsx("ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_INFO[s].contador)}>{itens.length}</span>
              </div>
              {itens.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhuma solicitação neste status.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                    <tr className="border-b border-neutral-200">
                      <th className="px-4 py-2 font-medium">Paciente</th>
                      <th className="px-4 py-2 font-medium">Setor solicitante</th>
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-4 py-2 font-medium">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr
                        key={i.id}
                        onClick={() => setSelecionadaId(i.id)}
                        onKeyDown={(e) => e.key === "Enter" && setSelecionadaId(i.id)}
                        tabIndex={0}
                        className="cursor-pointer border-b border-neutral-200 last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <td className={clsx("border-l-4 px-4 py-2.5 font-medium", STATUS_INFO[s].linha)}>{i.paciente_nome}</td>
                        <td className="px-4 py-2.5">{i.setor_nome}</td>
                        <td className="px-4 py-2.5 tabular-nums">{formatarData(i.data_solicitacao)}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums">{formatarHora(i.data_solicitacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}

      {selecionadaId && (
        <DetalheSolicitacao
          id={selecionadaId}
          onFechar={() => setSelecionadaId(null)}
          onAlterada={() => carregar(true)}
        />
      )}
      {novaAberta && (
        <NovaSolicitacao
          hemocomponentes={hemocomponentes}
          onFechar={() => setNovaAberta(false)}
          onCriada={(s) => {
            vistasRef.current?.ids.add(s.id);
            setNovaAberta(false);
            if (dia !== hojeLocal()) setDia(hojeLocal());
            else carregar(true);
          }}
        />
      )}
    </div>
  );
}

function Modal({ titulo, subtitulo, onFechar, children }: { titulo: string; subtitulo?: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-card bg-surface-card shadow-xl">
        <div className="flex items-start gap-3 rounded-t-card bg-hemo px-5 py-4 text-white">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{titulo}</h2>
            {subtitulo && <p className="text-sm text-white/80">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wide text-ink-muted">{rotulo}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function DetalheSolicitacao({ id, onFechar, onAlterada }: { id: string; onFechar: () => void; onAlterada: () => void }) {
  const [item, setItem] = useState<Solicitacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [entregando, setEntregando] = useState(false);

  function carregar() {
    api
      .get<Solicitacao>(`/solicitacoes/${id}`)
      .then(setItem)
      .catch((err) => setErro(mensagemErro(err, "Não foi possível carregar a solicitação.")));
  }

  useEffect(carregar, [id]);

  async function iniciar() {
    setProcessando(true);
    setErro(null);
    try {
      setItem(await api.post<Solicitacao>(`/solicitacoes/${id}/iniciar-processamento`));
      onAlterada();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível iniciar o processamento."));
    } finally {
      setProcessando(false);
    }
  }

  if (!item) {
    return (
      <Modal titulo="Solicitação" onFechar={onFechar}>
        {erro ? <p className="text-danger">{erro}</p> : <p className="text-ink-muted">Carregando...</p>}
      </Modal>
    );
  }

  return (
    <Modal titulo={item.paciente_nome} subtitulo={`${item.setor_nome} · ${STATUS_INFO[item.status].rotulo}`} onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Dado rotulo="Hemocomponente">
          {item.hemocomponente_sigla ?? item.hemocomponente_nome} · {item.quantidade} un.
        </Dado>
        <Dado rotulo="Prioridade">{PRIORIDADE_ROTULO[item.prioridade]}</Dado>
        <Dado rotulo="Solicitado em">
          {formatarData(item.data_solicitacao)} {formatarHora(item.data_solicitacao)}
        </Dado>
        <Dado rotulo="Médico solicitante">{item.medico_solicitante ?? "—"}</Dado>
        <Dado rotulo="Início do processamento">{formatarHora(item.data_inicio_processamento)}</Dado>
        <Dado rotulo="Entrega">{formatarHora(item.data_entrega)}</Dado>
        <div className="col-span-full">
          <Dado rotulo="Indicação">{item.indicacao ?? "—"}</Dado>
        </div>
      </div>

      {item.status === "ENTREGUE" && (
        <div className="space-y-3 border-t border-neutral-200 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dado rotulo="ABO/Rh do paciente">{item.abo_paciente}</Dado>
            <Dado rotulo="Prova cruzada">{item.prova_cruzada === "COMPATIVEL" ? "Compatível" : "Não se aplica"}</Dado>
            <Dado rotulo="Temp. transporte">{item.temperatura_transporte_c != null ? `${item.temperatura_transporte_c} °C` : "—"}</Dado>
            <Dado rotulo="Recebido por">{item.recebido_por}</Dado>
            <Dado rotulo="Liberação">{item.liberacao_com_ressalva ? "Com ressalva autorizada" : "Sem ressalvas"}</Dado>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-1">Nº da bolsa</th>
                <th className="py-1">ABO/Rh</th>
                <th className="py-1">Validade</th>
              </tr>
            </thead>
            <tbody>
              {item.bolsas.map((b) => (
                <tr key={b.id} className="border-t border-neutral-200">
                  <td className="py-1.5 font-mono">{rotuloBolsa(b)}</td>
                  <td className="py-1.5">{b.tipo_sanguineo}</td>
                  <td className="py-1.5">{new Date(`${b.data_validade}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entregando && item.status === "EM_PROCESSAMENTO" && (
        <FormEntrega
          solicitacao={item}
          onCancelar={() => setEntregando(false)}
          onEntregue={(s) => {
            setItem(s);
            setEntregando(false);
            onAlterada();
          }}
        />
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {!entregando && (
        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          {item.status === "SOLICITADO" && (
            <Button onClick={iniciar} disabled={processando}>
              {processando ? "Iniciando..." : "Iniciar processamento"}
            </Button>
          )}
          {item.status === "EM_PROCESSAMENTO" && <Button onClick={() => setEntregando(true)}>Registrar entrega</Button>}
        </div>
      )}
    </Modal>
  );
}

function FormEntrega({
  solicitacao,
  onCancelar,
  onEntregue,
}: {
  solicitacao: Solicitacao;
  onCancelar: () => void;
  onEntregue: (s: Solicitacao) => void;
}) {
  const [disponiveis, setDisponiveis] = useState<BolsaDisponivel[]>([]);
  const [aboPaciente, setAboPaciente] = useState(solicitacao.abo_paciente ?? "");
  const [bolsas, setBolsas] = useState<string[]>(() => Array(solicitacao.quantidade).fill(""));
  const [provaCruzada, setProvaCruzada] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [recebidoPor, setRecebidoPor] = useState("");
  const [ressalva, setRessalva] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BolsaDisponivel[]>(`/hemocomponentes-bolsas?status=DISPONIVEL&hemocomponente_id=${solicitacao.hemocomponente_id}&limit=200`)
      .then(setDisponiveis)
      .catch(() => setDisponiveis([]));
  }, [solicitacao.hemocomponente_id]);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const s = await api.post<Solicitacao>(`/solicitacoes/${solicitacao.id}/entregar`, {
        abo_paciente: aboPaciente,
        bolsas,
        prova_cruzada: provaCruzada || null,
        temperatura_transporte_c: temperatura ? Number(temperatura) : null,
        recebido_por: recebidoPor,
        autorizacao_ressalva: ressalva,
        observacoes: observacoes || null,
      });
      onEntregue(s);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível registrar a entrega."));
    } finally {
      setSalvando(false);
    }
  }

  const completo = aboPaciente && recebidoPor.trim().length >= 2 && bolsas.every(Boolean);

  return (
    <form onSubmit={confirmar} className="space-y-4 border-t border-neutral-200 pt-4">
      <h3 className="font-medium">Registrar entrega ao setor</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">ABO/Rh do paciente</label>
          <select required value={aboPaciente} onChange={(e) => setAboPaciente(e.target.value)} className={campo}>
            <option value="">Selecione...</option>
            {TIPOS_SANGUINEOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Prova cruzada</label>
          <select value={provaCruzada} onChange={(e) => setProvaCruzada(e.target.value)} className={campo}>
            <option value="">Não se aplica</option>
            <option value="COMPATIVEL">Compatível</option>
            <option value="INCOMPATIVEL">Incompatível</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Temp. no transporte (°C)</label>
          <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} className={campo} />
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium">Bolsas ({solicitacao.quantidade})</span>
        {disponiveis.length === 0 && (
          <p className="text-sm text-ink-muted">Nenhuma bolsa disponível deste hemocomponente no estoque.</p>
        )}
        {bolsas.map((valor, idx) => (
          <select
            key={idx}
            required
            value={valor}
            onChange={(e) => setBolsas(bolsas.map((b, i) => (i === idx ? e.target.value : b)))}
            className={campo}
            aria-label={`Bolsa ${idx + 1}`}
          >
            <option value="">Bolsa {idx + 1}: selecione...</option>
            {disponiveis
              .filter((d) => d.id === valor || !bolsas.includes(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {rotuloBolsa(d)} · {d.tipo_sanguineo ?? "sem ABO"} · val. {new Date(`${d.data_validade}T12:00:00`).toLocaleDateString("pt-BR")}
                </option>
              ))}
          </select>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Recebido por (setor)</label>
          <input required value={recebidoPor} onChange={(e) => setRecebidoPor(e.target.value)} placeholder="Nome e categoria" className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Observação</label>
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={campo} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ressalva} onChange={(e) => setRessalva(e.target.checked)} className="mt-1 accent-hemo" />
        Liberação com ressalva autorizada pelo médico hemoterapeuta (ex.: Rh+ para paciente Rh−, plaquetas não isogrupo).
      </label>

      {erro && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !completo}>
          {salvando ? "Registrando..." : "Confirmar entrega"}
        </Button>
      </div>
    </form>
  );
}

function NovaSolicitacao({
  hemocomponentes,
  onFechar,
  onCriada,
}: {
  hemocomponentes: Hemocomponente[];
  onFechar: () => void;
  onCriada: (s: Solicitacao) => void;
}) {
  const [internacoes, setInternacoes] = useState<InternacaoResumo[]>([]);
  const [pacientes, setPacientes] = useState<Map<string, string>>(new Map());
  const [internacaoId, setInternacaoId] = useState("");
  const [hemocomponenteId, setHemocomponenteId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [prioridade, setPrioridade] = useState("ROTINA");
  const [medico, setMedico] = useState("");
  const [indicacao, setIndicacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<InternacaoResumo[]>("/relatorios/internacoes?format=json"),
      api.get<Paciente[]>("/pacientes?limit=200"),
    ])
      .then(([i, p]) => {
        setInternacoes(i.filter((x) => !x.data_alta));
        setPacientes(new Map(p.map((x) => [x.id, x.nome])));
      })
      .catch(() => setErro("Não foi possível carregar as internações ativas."));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const s = await api.post<Solicitacao>("/solicitacoes", {
        internacao_id: internacaoId,
        hemocomponente_id: hemocomponenteId,
        quantidade: Number(quantidade),
        prioridade,
        medico_solicitante: medico || null,
        indicacao: indicacao || null,
      });
      onCriada(s);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível registrar a solicitação."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Nova solicitação" subtitulo="Pedido de hemocomponente para paciente internado" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Internação ativa</label>
          <select required value={internacaoId} onChange={(e) => setInternacaoId(e.target.value)} className={campo}>
            <option value="">Selecione...</option>
            {internacoes.map((i) => (
              <option key={i.id} value={i.id}>
                {pacientes.get(i.paciente_id) ?? "Paciente não identificado"}
                {i.numero_internacao ? ` — ${i.numero_internacao}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">O setor solicitante é o setor atual da internação.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Hemocomponente</label>
            <select required value={hemocomponenteId} onChange={(e) => setHemocomponenteId(e.target.value)} className={campo}>
              <option value="">Selecione...</option>
              {hemocomponentes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.sigla ? `${h.sigla} · ${h.nome}` : h.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Quantidade</label>
            <input type="number" min={1} max={20} required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={campo} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Prioridade</label>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={campo}>
              <option value="ROTINA">Rotina</option>
              <option value="URGENTE">Urgente</option>
              <option value="EMERGENCIA">Emergência</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Médico solicitante</label>
            <input maxLength={120} value={medico} onChange={(e) => setMedico(e.target.value)} className={campo} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Indicação clínica</label>
          <textarea rows={2} value={indicacao} onChange={(e) => setIndicacao(e.target.value)} className={campo} />
        </div>
        {erro && <p className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando || !internacaoId || !hemocomponenteId}>
            {salvando ? "Registrando..." : "Registrar solicitação"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
