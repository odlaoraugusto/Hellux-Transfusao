import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellRing, BellOff, Printer, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { alertaSonoroAtivo, definirAlertaSonoro, desbloquearAudio, tocarAlerta } from "@/lib/alertaSonoro";

type StatusSolicitacao = "SOLICITADO" | "EM_PROCESSAMENTO" | "ENTREGUE" | "CANCELADO";

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
  temperatura_transporte_c: number | null;
  recebido_por: string | null;
  observacoes_entrega: string | null;
  entregue_em: string | null;
  entregue_por_nome: string | null;
}

interface Solicitacao {
  id: string;
  internacao_id: string;
  formulario_solicitacao_id: string | null;
  paciente_id: string;
  paciente_nome: string;
  setor_solicitante_id: string;
  setor_nome: string;
  hemocomponente_id: string;
  hemocomponente_nome: string;
  hemocomponente_sigla: string | null;
  quantidade: number;
  volume_ml_solicitado: number | null;
  prioridade: "ROTINA" | "URGENTE" | "EMERGENCIA";
  indicacao: string | null;
  medico_solicitante: string | null;
  status: StatusSolicitacao;
  data_solicitacao: string;
  data_inicio_processamento: string | null;
  data_entrega: string | null;
  abo_paciente: string | null;
  pesquisa_anticorpos_irregulares: string | null;
  bolsas_registradas: number;
  bolsas_entregues: number;
  bolsas: BolsaEntregue[];
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
  cancelado_por_nome: string | null;
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

interface BolsaForm {
  numero_bolsa: string;
  tipo_sanguineo: string;
  data_validade: string;
  volume_ml: string;
  responsavel_testes: string;
}

const STATUS_ORDEM: StatusSolicitacao[] = ["SOLICITADO", "EM_PROCESSAMENTO", "ENTREGUE", "CANCELADO"];

const STATUS_INFO: Record<StatusSolicitacao, { rotulo: string; topo: string; linha: string; contador: string; fundo: string }> = {
  // 2026-10-07, pedido do cliente: "o preenchimento... segue bem ruim" —
  // tentei duas rodadas de preenchimento translúcido colorido no modo
  // escuro (amber-950/30, depois amber-400/10) e nenhuma ficou limpa:
  // qualquer cor meio-transparente em cima do fundo quase preto desatura
  // pro marrom/cinza sujo, principalmente o âmbar. O cliente apontou o
  // botão "Som ligado" como referência — ele não tem preenchimento
  // nenhum, só borda + texto numa cor sólida, sobre o mesmo fundo de
  // cartão de sempre. Mesma lógica aqui: no claro mantém o preenchimento
  // pastel (que já ficava bem), no escuro usa o cartão neutro padrão
  // (dark:bg-neutral-800, igual o resto do app) e deixa a cor aparecer
  // só na borda e no contador — ambos já sólidos/vibrantes, sem
  // transparência pra desaturar.
  SOLICITADO: {
    rotulo: "Solicitado",
    topo: "border-t-amber-500",
    linha: "border-l-amber-500",
    contador: "bg-amber-100 text-amber-800",
    fundo: "bg-amber-50/70 dark:bg-neutral-800",
  },
  EM_PROCESSAMENTO: {
    rotulo: "Em processamento",
    topo: "border-t-blue-600",
    linha: "border-l-blue-600",
    contador: "bg-blue-100 text-blue-800",
    fundo: "bg-blue-50/70 dark:bg-neutral-800",
  },
  ENTREGUE: {
    rotulo: "Entregue ao setor",
    topo: "border-t-success",
    linha: "border-l-success",
    contador: "bg-success/10 text-success",
    fundo: "bg-success/5 dark:bg-neutral-800",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    topo: "border-t-neutral-400",
    linha: "border-l-neutral-400",
    contador: "bg-neutral-200 text-neutral-600",
    fundo: "bg-neutral-100/70 dark:bg-neutral-800",
  },
};

const PRIORIDADE_ROTULO: Record<Solicitacao["prioridade"], string> = {
  ROTINA: "Rotina",
  URGENTE: "Urgente",
  EMERGENCIA: "Emergência",
};

const TIPOS_SANGUINEOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

// PAI = Pesquisa de Anticorpos Irregulares — exame pré-transfusional do
// paciente, sai junto com o ABO/Rh (2026-10-01, pedido do cliente).
const PAI_ROTULO: Record<string, string> = {
  NEGATIVA: "Negativa",
  POSITIVA: "Positiva",
  NAO_REALIZADA: "Não realizada",
};
const INTERVALO_ATUALIZACAO_MS = 10_000;

const campo =
  "w-full rounded-lg border border-neutral-300 bg-surface-card px-3 py-2 text-sm focus:border-hemo focus:outline-none";

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primeiro dia do mês corrente, no fuso local (2026-10-01, pedido do
 * cliente: filtro padrão é "do início do mês até hoje"). */
function primeiroDiaDoMesLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Início do dia `de` até o fim do dia `ate`, no fuso do navegador, em ISO
 * (UTC) para a API. */
function intervaloPeriodo(de: string, ate: string): { de: string; ate: string } {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return { de: new Date(a1, m1 - 1, d1).toISOString(), ate: new Date(a2, m2 - 1, d2 + 1).toISOString() };
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

export function SolicitacoesPage() {
  const { unidadeAtivaId } = useAuth();

  const [periodoDe, setPeriodoDe] = useState(primeiroDiaDoMesLocal);
  const [periodoAte, setPeriodoAte] = useState(hojeLocal);
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

  // Solicitações já vistas no período — só as que aparecerem depois disparam alerta.
  const vistasRef = useRef<{ periodo: string; ids: Set<string> } | null>(null);

  // Só faz sentido reatualizar sozinho / tocar alerta se o período visível
  // inclui hoje — um período todo no passado não vai ganhar solicitação nova.
  const incluiHoje = periodoAte >= hojeLocal();
  const periodo = `${periodoDe}_${periodoAte}`;

  function carregar(silencioso = false) {
    if (!unidadeAtivaId) return;
    if (!silencioso) setCarregando(true);
    const { de, ate } = intervaloPeriodo(periodoDe, periodoAte);
    api
      .get<Solicitacao[]>(`/solicitacoes?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
      .then((itens) => {
        setLista(itens);
        setErro(null);
        setAtualizadoEm(new Date());
        const vistas = vistasRef.current;
        if (!vistas || vistas.periodo !== periodo) {
          vistasRef.current = { periodo, ids: new Set(itens.map((i) => i.id)) };
        } else {
          const novas = itens.filter((i) => !vistas.ids.has(i.id) && i.status === "SOLICITADO");
          itens.forEach((i) => vistas.ids.add(i.id));
          if (novas.length) setAviso(novas);
        }
        // O alerta toca a cada atualização enquanto houver alguma solicitação
        // ainda "solicitada" (não processada) — não só na primeira vez que ela
        // aparece (2026-09-30, pedido do cliente: "enquanto estiver só
        // solicitada, fica no efeito sonoro"). Só com hoje no período visível.
        if (incluiHoje) {
          const pendentes = itens.filter((i) => i.status === "SOLICITADO");
          if (pendentes.length) tocarAlerta(pendentes.some((p) => p.prioridade === "EMERGENCIA"));
        }
      })
      .catch((err) => {
        if (!silencioso) setErro(mensagemErro(err, "Não foi possível carregar as solicitações."));
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    if (!incluiHoje) return;
    const timer = window.setInterval(() => carregar(true), INTERVALO_ATUALIZACAO_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId, periodoDe, periodoAte]);

  useEffect(() => {
    if (!unidadeAtivaId) return;
    Promise.all([api.get<Setor[]>("/setores"), api.get<Hemocomponente[]>("/hemocomponentes")])
      .then(([s, h]) => {
        setSetores(s);
        setHemocomponentes(h.filter((x) => x.ativo));
      })
      .catch(() => undefined);
  }, [unidadeAtivaId]);

  // Tenta liberar o áudio assim que a tela monta — na prática já costuma
  // estar liberado por um clique em tela anterior (ex.: "Entrar" no login,
  // ver instalarDesbloqueioAutomatico em App.tsx). O listener aqui é só
  // reserva, pra quando a pessoa chega direto nesta tela sem nenhum clique
  // antes (2026-10-02, pedido do cliente).
  useEffect(() => {
    if (audioLiberado) return;
    desbloquearAudio().then(setAudioLiberado);
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
    const c: Record<StatusSolicitacao, number> = { SOLICITADO: 0, EM_PROCESSAMENTO: 0, ENTREGUE: 0, CANCELADO: 0 };
    filtrada.forEach((s) => c[s.status]++);
    return c;
  }, [filtrada]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver as solicitações.</p>;
  }

  const statusVisiveis = filtroStatus ? [filtroStatus] : STATUS_ORDEM;
  const formatarCurta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tituloPeriodo = periodoDe === periodoAte ? formatarCurta(periodoDe) : `${formatarCurta(periodoDe)} a ${formatarCurta(periodoAte)}`;

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
          <label className="mb-1 block text-sm font-medium">De</label>
          <input
            type="date"
            value={periodoDe}
            max={periodoAte}
            onChange={(e) => e.target.value && setPeriodoDe(e.target.value)}
            className={clsx(campo, "w-40")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Até</label>
          <input
            type="date"
            value={periodoAte}
            min={periodoDe}
            max={hojeLocal()}
            onChange={(e) => e.target.value && setPeriodoAte(e.target.value)}
            className={clsx(campo, "w-40")}
          />
        </div>
        {(periodoDe !== primeiroDiaDoMesLocal() || periodoAte !== hojeLocal()) && (
          <Button
            variant="ghost"
            onClick={() => {
              setPeriodoDe(primeiroDiaDoMesLocal());
              setPeriodoAte(hojeLocal());
            }}
          >
            Este mês
          </Button>
        )}
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
        <h2 className="text-lg font-medium">{tituloPeriodo}</h2>
        <span className="text-sm text-ink-muted">
          {incluiHoje && atualizadoEm
            ? `Atualiza a cada ${INTERVALO_ATUALIZACAO_MS / 1000} s · última às ${atualizadoEm.toLocaleTimeString("pt-BR")}`
            : `${filtrada.length} solicitações`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_ORDEM.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltroStatus(filtroStatus === s ? "" : s)}
            aria-pressed={filtroStatus === s}
            className={clsx(
              "rounded-card border border-l-4 border-neutral-200 px-4 py-3 text-left shadow-sm",
              STATUS_INFO[s].linha,
              STATUS_INFO[s].fundo,
              filtroStatus === s && "ring-2 ring-hemo",
            )}
          >
            <span className="block text-xs text-ink-muted">{STATUS_INFO[s].rotulo}</span>
            <span className="text-xl font-semibold tabular-nums">{contagem[s]}</span>
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
              s === "ENTREGUE" || s === "CANCELADO"
                ? b.data_solicitacao.localeCompare(a.data_solicitacao)
                : a.data_solicitacao.localeCompare(b.data_solicitacao),
            );
          return (
            <section key={s} className={clsx("overflow-hidden rounded-card border border-t-4 border-neutral-200 shadow-sm", STATUS_INFO[s].topo, STATUS_INFO[s].fundo)}>
              <div className="flex items-center gap-2 border-b border-neutral-200/70 px-4 py-2.5">
                <h3 className="text-sm font-medium">{STATUS_INFO[s].rotulo}</h3>
                <span className={clsx("ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_INFO[s].contador)}>{itens.length}</span>
              </div>
              {itens.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhuma solicitação neste status.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                    <tr className="border-b border-neutral-200/70">
                      <th className="px-4 py-1.5 font-medium">Paciente</th>
                      <th className="px-4 py-1.5 font-medium">Setor solicitante</th>
                      <th className="px-4 py-1.5 font-medium">Data</th>
                      <th className="px-4 py-1.5 font-medium">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr
                        key={i.id}
                        onClick={() => setSelecionadaId(i.id)}
                        onKeyDown={(e) => e.key === "Enter" && setSelecionadaId(i.id)}
                        tabIndex={0}
                        className="cursor-pointer border-b border-neutral-200/70 last:border-0 hover:bg-white/60 dark:hover:bg-black/20"
                      >
                        <td className={clsx("border-l-4 px-4 py-2 font-medium", STATUS_INFO[s].linha)}>
                          {i.paciente_nome}
                          {i.status === "EM_PROCESSAMENTO" && i.bolsas_registradas > 0 && i.bolsas_registradas < i.quantidade && (
                            <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Parcial {i.bolsas_registradas}/{i.quantidade}
                            </span>
                          )}
                          {/* Pedido encerrado (cancelar()) com pelo menos 1 bolsa já
                              entregue antes do encerramento — ex.: pediu 2, só 1 foi
                              necessária e o médico suspendeu o resto (2026-10-08,
                              pedido do cliente). A entrega fica registrada
                              (histórico real), só não vira "ENTREGUE" porque nunca
                              chegou nas `quantidade` pedidas — esse selo deixa claro
                              que não foi um cancelamento "do zero". */}
                          {i.status === "CANCELADO" && i.bolsas_entregues > 0 && (
                            <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                              Encerrado parcial {i.bolsas_entregues}/{i.quantidade}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{i.setor_nome}</td>
                        <td className="px-4 py-2 tabular-nums">{formatarData(i.data_solicitacao)}</td>
                        <td className="px-4 py-2 font-semibold tabular-nums">{formatarHora(i.data_solicitacao)}</td>
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
  const navigate = useNavigate();
  const [item, setItem] = useState<Solicitacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [emitindoFolha, setEmitindoFolha] = useState(false);
  const [entregandoBolsaId, setEntregandoBolsaId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

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
          {item.hemocomponente_sigla ?? item.hemocomponente_nome} ·{" "}
          {item.volume_ml_solicitado != null ? `${item.volume_ml_solicitado} mL` : `${item.quantidade} un.`}
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

      {item.status === "EM_PROCESSAMENTO" && (
        <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium text-amber-800">
          Bolsas: {item.bolsas_registradas}/{item.quantidade} registradas · {item.bolsas_entregues}/{item.quantidade} entregues.
        </p>
      )}

      {item.status === "CANCELADO" && (
        <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-ink dark:bg-neutral-700">
          <p className="font-medium text-neutral-700 dark:text-neutral-200">
            {item.bolsas_entregues > 0
              ? `Encerrada parcialmente (${item.bolsas_entregues}/${item.quantidade} bolsa(s) entregues)`
              : "Cancelada"}{" "}
            {formatarData(item.cancelado_em)} {formatarHora(item.cancelado_em)}
            {item.cancelado_por_nome && ` por ${item.cancelado_por_nome}`}
          </p>
          {item.motivo_cancelamento && <p className="mt-1 whitespace-pre-wrap text-ink-muted">{item.motivo_cancelamento}</p>}
        </div>
      )}

      {(item.bolsas.length > 0 || item.status === "ENTREGUE") && (
        <div className="space-y-3 border-t border-neutral-200 pt-4">
          <Dado rotulo="ABO/Rh do paciente">{item.abo_paciente ?? "—"}</Dado>
          <Dado rotulo="PAI (Pesquisa de Anticorpos Irregulares)">
            {item.pesquisa_anticorpos_irregulares ? PAI_ROTULO[item.pesquisa_anticorpos_irregulares] : "—"}
          </Dado>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-1">Nº da bolsa</th>
                <th className="py-1">ABO/Rh</th>
                <th className="py-1">Validade</th>
                <th className="py-1">Volume</th>
                <th className="py-1">Compatibilidade</th>
                <th className="py-1">Entrega</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {item.bolsas.map((b) => (
                <tr key={b.id} className="border-t border-neutral-200 align-top">
                  <td className="py-1.5 font-mono">{b.numero_bolsa}</td>
                  <td className="py-1.5">{b.tipo_sanguineo}</td>
                  <td className="py-1.5">{new Date(`${b.data_validade}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="py-1.5">{b.volume_ml ? `${b.volume_ml} mL` : "—"}</td>
                  <td className="py-1.5">
                    {b.prova_cruzada === "COMPATIVEL" ? "Compatível" : b.prova_cruzada === "INCOMPATIVEL" ? "Incompatível" : "S/ teste"}
                    {b.liberacao_com_ressalva && <span className="ml-1 text-amber-700">(ressalva)</span>}
                  </td>
                  <td className="py-1.5">
                    {b.entregue_em ? (
                      <>
                        <span className="text-ink">Recebido por {b.recebido_por}</span>
                        <span className="block text-xs text-ink-muted">
                          {formatarData(b.entregue_em)} {formatarHora(b.entregue_em)}
                        </span>
                      </>
                    ) : item.status === "EM_PROCESSAMENTO" ? (
                      <Button onClick={() => setEntregandoBolsaId(b.id)} className="px-2 py-1 text-xs">
                        Entregar
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5">
                    <Link
                      to={`/solicitacoes/${item.id}/bolsas/${b.id}/folha`}
                      className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink hover:underline"
                      title="Reimprimir a Folha de Hemotransfusão desta bolsa"
                    >
                      <Printer size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emitindoFolha && item.status === "EM_PROCESSAMENTO" && (
        <FormFolha
          solicitacao={item}
          onCancelar={() => setEmitindoFolha(false)}
          onEmitida={(s, bolsaId) => {
            onAlterada();
            navigate(`/solicitacoes/${s.id}/bolsas/${bolsaId}/folha`);
          }}
        />
      )}

      {entregandoBolsaId && item.bolsas.find((b) => b.id === entregandoBolsaId) && (
        <FormEntrega
          solicitacao={item}
          bolsa={item.bolsas.find((b) => b.id === entregandoBolsaId)!}
          onCancelar={() => setEntregandoBolsaId(null)}
          onEntregue={(s) => {
            setItem(s);
            setEntregandoBolsaId(null);
            onAlterada();
          }}
        />
      )}

      {cancelando && (item.status === "SOLICITADO" || item.status === "EM_PROCESSAMENTO") && (
        <FormCancelar
          solicitacao={item}
          onCancelar={() => setCancelando(false)}
          onCancelada={(s) => {
            setItem(s);
            setCancelando(false);
            onAlterada();
          }}
        />
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {!emitindoFolha && !entregandoBolsaId && !cancelando && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-4">
          <div className="flex flex-col gap-1">
            {item.formulario_solicitacao_id && (
              <Link
                to={`/formularios/${item.formulario_solicitacao_id}/imprimir`}
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink hover:underline"
                title="Abre o formulário original para reimprimir o PDF"
              >
                <Printer size={14} />
                Reimprimir formulário
              </Link>
            )}
            {(item.status === "SOLICITADO" || item.status === "EM_PROCESSAMENTO") && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-danger hover:underline"
              >
                {item.bolsas_entregues > 0 ? "Encerrar solicitação parcial" : "Cancelar solicitação"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onFechar}>
              Fechar
            </Button>
            {item.status === "SOLICITADO" && (
              <Button onClick={iniciar} disabled={processando}>
                {processando ? "Iniciando..." : "Iniciar processamento"}
              </Button>
            )}
            {item.status === "EM_PROCESSAMENTO" && item.bolsas_registradas < item.quantidade && (
              <Button onClick={() => setEmitindoFolha(true)}>Adicionar bolsa</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormCancelar({
  solicitacao,
  onCancelar,
  onCancelada,
}: {
  solicitacao: Solicitacao;
  onCancelar: () => void;
  onCancelada: (s: Solicitacao) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const s = await api.post<Solicitacao>(`/solicitacoes/${solicitacao.id}/cancelar`, { motivo });
      onCancelada(s);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível cancelar a solicitação."));
    } finally {
      setSalvando(false);
    }
  }

  // Pedido parcial (2026-10-08, pedido do cliente: "pediu duas bolsas, só
  // mandou uma e a médica suspendeu o uso da segunda, como proceder para
  // encerrar esse pedido parcial?") — mesma ação de sempre
  // (`POST /solicitacoes/{id}/cancelar`, que já preserva as bolsas
  // entregues como fato histórico), só com rótulo/explicação corretos
  // pra esse caso em vez de soar como "cancelamento do zero".
  const parcial = solicitacao.bolsas_entregues > 0;

  return (
    <form onSubmit={confirmar} className="space-y-3 border-t border-neutral-200 pt-4">
      <h3 className="font-medium text-danger">{parcial ? "Encerrar solicitação parcial" : "Cancelar solicitação"}</h3>
      <p className="text-sm text-ink-muted">
        {parcial ? (
          <>
            {solicitacao.bolsas_entregues} de {solicitacao.quantidade} bolsa(s) já foram entregues — essa entrega
            continua registrada normalmente. O restante ({solicitacao.quantidade - solicitacao.bolsas_entregues}{" "}
            bolsa(s) ainda não entregues) será encerrado e a solicitação não ficará mais pendente. Essa ação não
            pode ser desfeita.
          </>
        ) : (
          "Ex.: erro de digitação do médico ou suspensão da transfusão. Essa ação não pode ser desfeita."
        )}
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium">
          {parcial ? "Motivo do encerramento do restante" : "Motivo do cancelamento"}
        </label>
        <textarea
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          autoFocus
          placeholder={parcial ? "Ex.: médica suspendeu a necessidade da(s) bolsa(s) restante(s)." : undefined}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={campo}
        />
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={salvando || motivo.trim().length < 3}>
          {salvando ? "Salvando..." : parcial ? "Confirmar encerramento parcial" : "Confirmar cancelamento"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

function FormFolha({
  solicitacao,
  onCancelar,
  onEmitida,
}: {
  solicitacao: Solicitacao;
  onCancelar: () => void;
  onEmitida: (s: Solicitacao, bolsaId: string) => void;
}) {
  const aboTravado = Boolean(solicitacao.abo_paciente);
  const [aboPaciente, setAboPaciente] = useState(solicitacao.abo_paciente ?? "");
  const paiTravado = Boolean(solicitacao.pesquisa_anticorpos_irregulares);
  const [pai, setPai] = useState(solicitacao.pesquisa_anticorpos_irregulares ?? "");
  const [bolsa, setBolsa] = useState<BolsaForm>({ numero_bolsa: "", tipo_sanguineo: "", data_validade: "", volume_ml: "", responsavel_testes: "" });
  const [provaCruzada, setProvaCruzada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function definirBolsa(parcial: Partial<BolsaForm>) {
    setBolsa((atual) => ({ ...atual, ...parcial }));
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const s = await api.post<Solicitacao & { bolsa_id: string }>(`/solicitacoes/${solicitacao.id}/bolsas`, {
        abo_paciente: aboPaciente,
        pesquisa_anticorpos_irregulares: pai,
        numero_bolsa: bolsa.numero_bolsa,
        tipo_sanguineo: bolsa.tipo_sanguineo,
        data_validade: bolsa.data_validade,
        volume_ml: bolsa.volume_ml ? Number(bolsa.volume_ml) : null,
        prova_cruzada: provaCruzada || null,
        responsavel_testes: bolsa.responsavel_testes,
      });
      onEmitida(s, s.bolsa_id);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível registrar a bolsa."));
    } finally {
      setSalvando(false);
    }
  }

  const completo =
    aboPaciente &&
    pai &&
    bolsa.numero_bolsa.trim() &&
    bolsa.tipo_sanguineo &&
    bolsa.data_validade &&
    bolsa.responsavel_testes.trim().length >= 2;
  const proximaBolsa = solicitacao.bolsas_registradas + 1;

  return (
    <form onSubmit={confirmar} className="space-y-4 border-t border-neutral-200 pt-4">
      <h3 className="font-medium">
        Registrar bolsa {proximaBolsa} de {solicitacao.quantidade}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">ABO/Rh do paciente</label>
          {aboTravado ? (
            <p className={clsx(campo, "bg-neutral-100 dark:bg-neutral-700")}>{aboPaciente}</p>
          ) : (
            <select required value={aboPaciente} onChange={(e) => setAboPaciente(e.target.value)} className={campo}>
              <option value="">Selecione...</option>
              {TIPOS_SANGUINEOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">PAI (Pesquisa de Anticorpos Irregulares)</label>
          {paiTravado ? (
            <p className={clsx(campo, "bg-neutral-100 dark:bg-neutral-700")}>{PAI_ROTULO[pai] ?? pai}</p>
          ) : (
            <select required value={pai} onChange={(e) => setPai(e.target.value)} className={campo}>
              <option value="">Selecione...</option>
              <option value="NEGATIVA">Negativa</option>
              <option value="POSITIVA">Positiva</option>
              <option value="NAO_REALIZADA">Não realizada</option>
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Compatibilidade</label>
          <select value={provaCruzada} onChange={(e) => setProvaCruzada(e.target.value)} className={campo}>
            <option value="">Emergência sem teste</option>
            <option value="COMPATIVEL">Compatível</option>
            <option value="INCOMPATIVEL">Incompatível</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium">Dados da bolsa</span>
        <p className="text-xs text-ink-muted">Digite o que está escrito no rótulo da bolsa liberada.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="bolsa_numero" className="mb-1 block text-xs font-medium text-ink-muted">
              Nº da bolsa
            </label>
            <input
              id="bolsa_numero"
              required
              value={bolsa.numero_bolsa}
              onChange={(e) => definirBolsa({ numero_bolsa: e.target.value })}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="bolsa_abo" className="mb-1 block text-xs font-medium text-ink-muted">
              ABO/Rh da bolsa
            </label>
            <select
              id="bolsa_abo"
              required
              value={bolsa.tipo_sanguineo}
              onChange={(e) => definirBolsa({ tipo_sanguineo: e.target.value })}
              className={campo}
            >
              <option value="">Selecione...</option>
              {TIPOS_SANGUINEOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bolsa_validade" className="mb-1 block text-xs font-medium text-ink-muted">
              Validade da bolsa
            </label>
            <input
              id="bolsa_validade"
              required
              type="date"
              value={bolsa.data_validade}
              onChange={(e) => definirBolsa({ data_validade: e.target.value })}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="bolsa_volume" className="mb-1 block text-xs font-medium text-ink-muted">
              Volume (mL)
            </label>
            <input
              id="bolsa_volume"
              type="number"
              min={1}
              value={bolsa.volume_ml}
              onChange={(e) => definirBolsa({ volume_ml: e.target.value })}
              className={campo}
            />
          </div>
        </div>
        <div>
          <label htmlFor="bolsa_responsavel" className="mb-1 block text-xs font-medium text-ink-muted">
            Responsável pelos testes
          </label>
          <input
            id="bolsa_responsavel"
            required
            value={bolsa.responsavel_testes}
            onChange={(e) => definirBolsa({ responsavel_testes: e.target.value })}
            placeholder="Nome de quem liberou a bolsa no banco de sangue"
            className={campo}
          />
        </div>
      </div>

      {erro && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !completo}>
          {salvando ? "Registrando..." : "Registrar bolsa"}
        </Button>
      </div>
    </form>
  );
}

function FormEntrega({
  solicitacao,
  bolsa,
  onCancelar,
  onEntregue,
}: {
  solicitacao: Solicitacao;
  bolsa: BolsaEntregue;
  onCancelar: () => void;
  onEntregue: (s: Solicitacao) => void;
}) {
  const [temperatura, setTemperatura] = useState("");
  const [recebidoPor, setRecebidoPor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const s = await api.post<Solicitacao>(`/solicitacoes/${solicitacao.id}/bolsas/${bolsa.id}/entregar`, {
        temperatura_transporte_c: temperatura ? Number(temperatura) : null,
        recebido_por: recebidoPor,
        observacoes: observacoes || null,
      });
      onEntregue(s);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível registrar a entrega."));
    } finally {
      setSalvando(false);
    }
  }

  const completo = recebidoPor.trim().length >= 2;

  return (
    <form onSubmit={confirmar} className="space-y-4 border-t border-neutral-200 pt-4">
      <h3 className="font-medium">Registrar entrega da bolsa {bolsa.numero_bolsa}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Recebido por</label>
          <input required value={recebidoPor} onChange={(e) => setRecebidoPor(e.target.value)} placeholder="Nome do profissional" className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Temp. no transporte (°C)</label>
          <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Observação</label>
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={campo} />
        </div>
      </div>

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
