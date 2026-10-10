import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Snowflake, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Paciente } from "@/types";

type StatusBolsa = "DISPONIVEL" | "RESERVADO" | "TRANSFUNDIDO" | "DEVOLVIDO" | "DESCARTADO";

interface Bolsa {
  id: string;
  hemocomponente_id: string;
  numero_bolsa: string;
  numero_macarrao: string | null;
  codigo_satelite: string | null;
  bolsa_mae_id: string | null;
  tipo_sanguineo: string | null;
  data_coleta: string | null;
  data_validade: string;
  status: StatusBolsa;
  paciente_reservado_id: string | null;
}

interface Hemocomponente {
  id: string;
  nome: string;
  sigla: string | null;
  descricao: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  validade_padrao_dias: number | null;
}

interface FormState {
  hemocomponente_id: string;
  numero_bolsa: string;
  numero_macarrao: string;
  tipo_sanguineo: string;
  data_coleta: string;
  data_validade: string;
}

const FORM_VAZIO: FormState = {
  hemocomponente_id: "",
  numero_bolsa: "",
  numero_macarrao: "",
  tipo_sanguineo: "",
  data_coleta: "",
  data_validade: "",
};

const STATUS_OPCOES: { valor: StatusBolsa | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todos os status" },
  { valor: "DISPONIVEL", rotulo: "Disponível" },
  { valor: "RESERVADO", rotulo: "Reservado" },
  { valor: "TRANSFUNDIDO", rotulo: "Transfundido" },
  { valor: "DEVOLVIDO", rotulo: "Devolvido" },
  { valor: "DESCARTADO", rotulo: "Descartado" },
];

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function HemocomponentesPage() {
  const { unidadeAtivaId } = useAuth();

  const [bolsas, setBolsas] = useState<Bolsa[]>([]);
  const [estoque, setEstoque] = useState<Bolsa[]>([]);
  const [catalogo, setCatalogo] = useState<Hemocomponente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<StatusBolsa | "">("");
  const [filtroNumero, setFiltroNumero] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [reservandoId, setReservandoId] = useState<string | null>(null);
  const [termoPaciente, setTermoPaciente] = useState("");
  const [pacientesEncontrados, setPacientesEncontrados] = useState<Paciente[]>([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [erroReserva, setErroReserva] = useState<string | null>(null);

  const [fracionandoId, setFracionandoId] = useState<string | null>(null);
  const [quantidadeFracoes, setQuantidadeFracoes] = useState("2");
  const [erroFracionamento, setErroFracionamento] = useState<string | null>(null);

  const mapaCatalogo = useMemo(() => {
    const mapa = new Map<string, Hemocomponente>();
    catalogo.forEach((h) => mapa.set(h.id, h));
    return mapa;
  }, [catalogo]);

  function nomeHemocomponente(id: string): string {
    const item = mapaCatalogo.get(id);
    if (!item) return "—";
    return item.sigla ? `${item.nome} (${item.sigla})` : item.nome;
  }

  function carregar() {
    if (!unidadeAtivaId) return;
    setCarregando(true);
    setErroLista(null);
    const params = new URLSearchParams();
    if (filtroStatus) params.set("status", filtroStatus);
    if (filtroNumero) params.set("numero_bolsa", filtroNumero);
    params.set("limit", "200");

    Promise.all([
      api.get<Bolsa[]>(`/hemocomponentes-bolsas?${params.toString()}`),
      api.get<Bolsa[]>("/hemocomponentes-bolsas?status=DISPONIVEL&limit=200"),
    ])
      .then(([lista, disponiveis]) => {
        setBolsas(lista);
        setEstoque(disponiveis);
      })
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar as bolsas de hemocomponentes.")))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    if (!unidadeAtivaId) return;
    api
      .get<Hemocomponente[]>("/hemocomponentes")
      .then(setCatalogo)
      .catch(() => setCatalogo([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  useEffect(() => {
    if (!unidadeAtivaId) return;
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId, filtroStatus, filtroNumero]);

  useEffect(() => {
    if (!reservandoId) return;
    const timeout = setTimeout(() => {
      if (!termoPaciente) {
        setPacientesEncontrados([]);
        return;
      }
      setBuscandoPaciente(true);
      api
        .get<Paciente[]>(`/pacientes?termo=${encodeURIComponent(termoPaciente)}`)
        .then(setPacientesEncontrados)
        .catch(() => setPacientesEncontrados([]))
        .finally(() => setBuscandoPaciente(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [termoPaciente, reservandoId]);

  const resumoEstoque = useMemo(() => {
    const contagem = new Map<string, number>();
    estoque.forEach((b) => {
      contagem.set(b.hemocomponente_id, (contagem.get(b.hemocomponente_id) ?? 0) + 1);
    });
    return Array.from(contagem.entries()).map(([hemocomponenteId, total]) => ({
      hemocomponenteId,
      total,
      nome: nomeHemocomponente(hemocomponenteId),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estoque, catalogo]);

  function abrirCriacao() {
    setForm(FORM_VAZIO);
    setErroForm(null);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setErroForm(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      await api.post("/hemocomponentes-bolsas", {
        hemocomponente_id: form.hemocomponente_id,
        numero_bolsa: form.numero_bolsa,
        numero_macarrao: form.numero_macarrao || null,
        tipo_sanguineo: form.tipo_sanguineo || null,
        data_coleta: form.data_coleta || null,
        data_validade: form.data_validade,
      });
      fecharForm();
      carregar();
    } catch (err) {
      setErroForm(mensagemErro(err, "Não foi possível cadastrar a bolsa."));
    } finally {
      setSalvando(false);
    }
  }

  function abrirReserva(bolsaId: string) {
    setReservandoId(bolsaId);
    setTermoPaciente("");
    setPacientesEncontrados([]);
    setPacienteSelecionado(null);
    setErroReserva(null);
  }

  function fecharReserva() {
    setReservandoId(null);
    setPacienteSelecionado(null);
    setErroReserva(null);
  }

  async function confirmarReserva() {
    if (!reservandoId || !pacienteSelecionado) return;
    setErroReserva(null);
    try {
      await api.post(`/hemocomponentes-bolsas/${reservandoId}/reservar`, {
        paciente_id: pacienteSelecionado.id,
      });
      fecharReserva();
      carregar();
    } catch (err) {
      setErroReserva(mensagemErro(err, "Não foi possível reservar a bolsa."));
    }
  }

  function abrirFracionamento(bolsaId: string) {
    setFracionandoId(bolsaId);
    setQuantidadeFracoes("2");
    setErroFracionamento(null);
  }

  function fecharFracionamento() {
    setFracionandoId(null);
    setErroFracionamento(null);
  }

  async function confirmarFracionamento() {
    if (!fracionandoId) return;
    const quantidade = Number(quantidadeFracoes);
    if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > 10) {
      setErroFracionamento("Informe uma quantidade entre 2 e 10.");
      return;
    }
    setErroFracionamento(null);
    try {
      await api.post(`/hemocomponentes-bolsas/${fracionandoId}/fracionar`, {
        quantidade_fracoes: quantidade,
      });
      fecharFracionamento();
      carregar();
    } catch (err) {
      setErroFracionamento(mensagemErro(err, "Não foi possível fracionar a bolsa."));
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os hemocomponentes.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hemocomponentes</h1>
        <Button onClick={abrirCriacao} className="flex items-center gap-2">
          <Plus size={16} />
          Nova Bolsa
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {resumoEstoque.length === 0 ? (
          <Card className="col-span-full py-4 text-center text-sm text-ink-muted">
            Nenhuma bolsa disponível em estoque no momento.
          </Card>
        ) : (
          resumoEstoque.map((item) => (
            <Card key={item.hemocomponenteId} className="p-4">
              <p className="text-xs font-medium uppercase text-ink-muted">{item.nome}</p>
              <p className="mt-1 text-2xl font-semibold text-hemo-dark">{item.total}</p>
            </Card>
          ))
        )}
      </div>

      {formAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Nova Bolsa</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Hemocomponente</label>
              <select
                required
                value={form.hemocomponente_id}
                onChange={(e) => setForm({ ...form, hemocomponente_id: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="">Selecione...</option>
                {catalogo.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.sigla ? `${h.nome} (${h.sigla})` : h.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Número da Bolsa</label>
              <input
                required
                minLength={1}
                maxLength={30}
                value={form.numero_bolsa}
                onChange={(e) => setForm({ ...form, numero_bolsa: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nº Macarrão (segmento para reteste)</label>
              <input
                maxLength={30}
                value={form.numero_macarrao}
                onChange={(e) => setForm({ ...form, numero_macarrao: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo Sanguíneo</label>
              <input
                maxLength={3}
                placeholder="Ex: O+"
                value={form.tipo_sanguineo}
                onChange={(e) => setForm({ ...form, tipo_sanguineo: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data de Coleta</label>
              <input
                type="date"
                value={form.data_coleta}
                onChange={(e) => setForm({ ...form, data_coleta: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data de Validade</label>
              <input
                required
                type="date"
                value={form.data_validade}
                onChange={(e) => setForm({ ...form, data_validade: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>

            {erroForm && <p className="text-sm text-danger sm:col-span-2">{erroForm}</p>}

            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="ghost" onClick={fecharForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {reservandoId && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Reservar Bolsa para Paciente</h2>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
            <input
              value={termoPaciente}
              onChange={(e) => {
                setTermoPaciente(e.target.value);
                setPacienteSelecionado(null);
              }}
              placeholder="Buscar paciente por nome ou nome da mãe..."
              className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-hemo focus:outline-none"
            />
          </div>

          {buscandoPaciente && <p className="mt-2 text-sm text-ink-muted">Buscando...</p>}

          {!buscandoPaciente && pacientesEncontrados.length > 0 && !pacienteSelecionado && (
            <ul className="mt-2 max-h-48 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
              {pacientesEncontrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPacienteSelecionado(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    {p.nome} {p.numero_prontuario ? `— ${p.numero_prontuario}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pacienteSelecionado && (
            <p className="mt-2 text-sm">
              Paciente selecionado: <span className="font-medium">{pacienteSelecionado.nome}</span>
            </p>
          )}

          {erroReserva && <p className="mt-2 text-sm text-danger">{erroReserva}</p>}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={confirmarReserva} disabled={!pacienteSelecionado}>
              Confirmar Reserva
            </Button>
            <Button type="button" variant="ghost" onClick={fecharReserva}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {fracionandoId && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">Fracionar Bolsa</h2>
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium">Quantidade de frações (2 a 10)</label>
            <input
              type="number"
              min={2}
              max={10}
              value={quantidadeFracoes}
              onChange={(e) => setQuantidadeFracoes(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
            />
          </div>

          {erroFracionamento && <p className="mt-2 text-sm text-danger">{erroFracionamento}</p>}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={confirmarFracionamento}>Confirmar Fracionamento</Button>
            <Button type="button" variant="ghost" onClick={fecharFracionamento}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusBolsa | "")}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
        >
          {STATUS_OPCOES.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>

        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
          <input
            value={filtroNumero}
            onChange={(e) => setFiltroNumero(e.target.value)}
            placeholder="Buscar por número da bolsa..."
            className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-hemo focus:outline-none"
          />
        </div>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Hemocomponente</th>
              <th className="px-4 py-3 font-medium">Tipo Sanguíneo</th>
              <th className="px-4 py-3 font-medium">Validade</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={6}>
                  Carregando...
                </td>
              </tr>
            ) : erroLista ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={6}>
                  {erroLista}
                </td>
              </tr>
            ) : bolsas.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={6}>
                  Nenhuma bolsa encontrada.
                </td>
              </tr>
            ) : (
              bolsas.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    {b.numero_bolsa}
                    {b.codigo_satelite ? <span className="text-ink-muted"> / {b.codigo_satelite}</span> : null}
                    {b.numero_macarrao && (
                      <span className="block text-xs text-ink-muted">Macarrão: {b.numero_macarrao}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{nomeHemocomponente(b.hemocomponente_id)}</td>
                  <td className="px-4 py-3">{b.tipo_sanguineo ?? "—"}</td>
                  <td className="px-4 py-3">{formatarData(b.data_validade)}</td>
                  <td className="px-4 py-3">
                    <Badge status={b.status}>{STATUS_OPCOES.find((o) => o.valor === b.status)?.rotulo ?? b.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {b.status === "DISPONIVEL" && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => abrirReserva(b.id)}
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-hemo"
                          title="Reservar"
                        >
                          <UserPlus size={16} />
                        </button>
                        <button
                          onClick={() => abrirFracionamento(b.id)}
                          className="inline-flex items-center gap-1 text-ink-muted hover:text-hemo"
                          title="Fracionar"
                        >
                          <Snowflake size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
