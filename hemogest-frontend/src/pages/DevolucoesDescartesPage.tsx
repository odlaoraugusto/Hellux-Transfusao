import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Bolsa {
  id: string;
  numero_bolsa: string;
  status: string;
}

interface Motivo {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

interface DevolucaoHistorico {
  id: string;
  unidade_hemocomponente_id: string;
  motivo_devolucao_id: string;
  data_devolucao: string;
}

interface DescarteHistorico {
  id: string;
  unidade_hemocomponente_id: string;
  motivo_descarte_id: string;
  data_descarte: string;
}

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR");
}

interface BuscaBolsaProps {
  termo: string;
  onTermoChange: (valor: string) => void;
  resultados: Bolsa[];
  buscando: boolean;
  selecionada: Bolsa | null;
  onSelecionar: (bolsa: Bolsa) => void;
}

function BuscaBolsa({ termo, onTermoChange, resultados, buscando, selecionada, onSelecionar }: BuscaBolsaProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Bolsa</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
        <input
          value={termo}
          onChange={(e) => onTermoChange(e.target.value)}
          placeholder="Buscar por número da bolsa..."
          className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-hemo focus:outline-none"
        />
      </div>
      {buscando && <p className="mt-1 text-sm text-ink-muted">Buscando...</p>}
      {!buscando && resultados.length > 0 && !selecionada && (
        <ul className="mt-1 max-h-40 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
          {resultados.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelecionar(b)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {b.numero_bolsa} <span className="text-ink-muted">({b.status})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selecionada && (
        <p className="mt-1 text-sm">
          Bolsa selecionada: <span className="font-medium">{selecionada.numero_bolsa}</span>
        </p>
      )}
    </div>
  );
}

export function DevolucoesDescartesPage() {
  const { unidadeAtivaId } = useAuth();

  const [motivosDevolucao, setMotivosDevolucao] = useState<Motivo[]>([]);
  const [motivosDescarte, setMotivosDescarte] = useState<Motivo[]>([]);
  const [bolsasCache, setBolsasCache] = useState<Bolsa[]>([]);

  const [devolucoes, setDevolucoes] = useState<DevolucaoHistorico[]>([]);
  const [descartes, setDescartes] = useState<DescarteHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  const [termoBolsaDevolucao, setTermoBolsaDevolucao] = useState("");
  const [resultadosBolsaDevolucao, setResultadosBolsaDevolucao] = useState<Bolsa[]>([]);
  const [buscandoBolsaDevolucao, setBuscandoBolsaDevolucao] = useState(false);
  const [bolsaDevolucao, setBolsaDevolucao] = useState<Bolsa | null>(null);
  const [motivoDevolucaoId, setMotivoDevolucaoId] = useState("");
  const [observacaoDevolucao, setObservacaoDevolucao] = useState("");
  const [salvandoDevolucao, setSalvandoDevolucao] = useState(false);
  const [erroDevolucao, setErroDevolucao] = useState<string | null>(null);

  const [termoBolsaDescarte, setTermoBolsaDescarte] = useState("");
  const [resultadosBolsaDescarte, setResultadosBolsaDescarte] = useState<Bolsa[]>([]);
  const [buscandoBolsaDescarte, setBuscandoBolsaDescarte] = useState(false);
  const [bolsaDescarte, setBolsaDescarte] = useState<Bolsa | null>(null);
  const [motivoDescarteId, setMotivoDescarteId] = useState("");
  const [observacaoDescarte, setObservacaoDescarte] = useState("");
  const [salvandoDescarte, setSalvandoDescarte] = useState(false);
  const [erroDescarte, setErroDescarte] = useState<string | null>(null);

  const mapaMotivosDevolucao = useMemo(() => {
    const mapa = new Map<string, string>();
    motivosDevolucao.forEach((m) => mapa.set(m.id, m.nome));
    return mapa;
  }, [motivosDevolucao]);

  const mapaMotivosDescarte = useMemo(() => {
    const mapa = new Map<string, string>();
    motivosDescarte.forEach((m) => mapa.set(m.id, m.nome));
    return mapa;
  }, [motivosDescarte]);

  const mapaBolsas = useMemo(() => {
    const mapa = new Map<string, string>();
    bolsasCache.forEach((b) => mapa.set(b.id, b.numero_bolsa));
    return mapa;
  }, [bolsasCache]);

  function carregarHistorico() {
    if (!unidadeAtivaId) return;
    setCarregandoHistorico(true);
    setErroHistorico(null);
    Promise.all([
      api.get<DevolucaoHistorico[]>("/relatorios/devolucoes?format=json"),
      api.get<DescarteHistorico[]>("/relatorios/descartes?format=json"),
      api.get<Bolsa[]>("/hemocomponentes-bolsas?limit=200"),
    ])
      .then(([listaDevolucoes, listaDescartes, listaBolsas]) => {
        setDevolucoes(listaDevolucoes);
        setDescartes(listaDescartes);
        setBolsasCache(listaBolsas);
      })
      .catch((err) => setErroHistorico(mensagemErro(err, "Não foi possível carregar o histórico.")))
      .finally(() => setCarregandoHistorico(false));
  }

  useEffect(() => {
    if (!unidadeAtivaId) return;
    api
      .get<Motivo[]>("/motivos-devolucao")
      .then(setMotivosDevolucao)
      .catch(() => setMotivosDevolucao([]));
    api
      .get<Motivo[]>("/motivos-descarte")
      .then(setMotivosDescarte)
      .catch(() => setMotivosDescarte([]));
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  useEffect(() => {
    if (bolsaDevolucao) return;
    const timeout = setTimeout(() => {
      if (!termoBolsaDevolucao) {
        setResultadosBolsaDevolucao([]);
        return;
      }
      setBuscandoBolsaDevolucao(true);
      api
        .get<Bolsa[]>(`/hemocomponentes-bolsas?numero_bolsa=${encodeURIComponent(termoBolsaDevolucao)}`)
        .then((lista) => setResultadosBolsaDevolucao(lista.filter((b) => b.status === "DISPONIVEL" || b.status === "RESERVADO")))
        .catch(() => setResultadosBolsaDevolucao([]))
        .finally(() => setBuscandoBolsaDevolucao(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [termoBolsaDevolucao, bolsaDevolucao]);

  useEffect(() => {
    if (bolsaDescarte) return;
    const timeout = setTimeout(() => {
      if (!termoBolsaDescarte) {
        setResultadosBolsaDescarte([]);
        return;
      }
      setBuscandoBolsaDescarte(true);
      api
        .get<Bolsa[]>(`/hemocomponentes-bolsas?numero_bolsa=${encodeURIComponent(termoBolsaDescarte)}`)
        .then((lista) => setResultadosBolsaDescarte(lista.filter((b) => b.status === "DISPONIVEL" || b.status === "RESERVADO")))
        .catch(() => setResultadosBolsaDescarte([]))
        .finally(() => setBuscandoBolsaDescarte(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [termoBolsaDescarte, bolsaDescarte]);

  function limparFormDevolucao() {
    setTermoBolsaDevolucao("");
    setResultadosBolsaDevolucao([]);
    setBolsaDevolucao(null);
    setMotivoDevolucaoId("");
    setObservacaoDevolucao("");
    setErroDevolucao(null);
  }

  function limparFormDescarte() {
    setTermoBolsaDescarte("");
    setResultadosBolsaDescarte([]);
    setBolsaDescarte(null);
    setMotivoDescarteId("");
    setObservacaoDescarte("");
    setErroDescarte(null);
  }

  async function registrarDevolucao() {
    if (!bolsaDevolucao || !motivoDevolucaoId) return;
    setErroDevolucao(null);
    setSalvandoDevolucao(true);
    try {
      await api.post("/devolucoes", {
        unidade_hemocomponente_id: bolsaDevolucao.id,
        motivo_devolucao_id: motivoDevolucaoId,
        observacao: observacaoDevolucao || null,
      });
      limparFormDevolucao();
      carregarHistorico();
    } catch (err) {
      setErroDevolucao(mensagemErro(err, "Não foi possível registrar a devolução."));
    } finally {
      setSalvandoDevolucao(false);
    }
  }

  async function registrarDescarte() {
    if (!bolsaDescarte || !motivoDescarteId) return;
    setErroDescarte(null);
    setSalvandoDescarte(true);
    try {
      await api.post("/descartes", {
        unidade_hemocomponente_id: bolsaDescarte.id,
        motivo_descarte_id: motivoDescarteId,
        observacao: observacaoDescarte || null,
      });
      limparFormDescarte();
      carregarHistorico();
    } catch (err) {
      setErroDescarte(mensagemErro(err, "Não foi possível registrar o descarte."));
    } finally {
      setSalvandoDescarte(false);
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver devoluções e descartes.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Devoluções / Descartes</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-medium">Nova Devolução</h2>
          <div className="space-y-4">
            <BuscaBolsa
              termo={termoBolsaDevolucao}
              onTermoChange={(valor) => {
                setTermoBolsaDevolucao(valor);
                setBolsaDevolucao(null);
              }}
              resultados={resultadosBolsaDevolucao}
              buscando={buscandoBolsaDevolucao}
              selecionada={bolsaDevolucao}
              onSelecionar={setBolsaDevolucao}
            />

            <div>
              <label className="mb-1 block text-sm font-medium">Motivo</label>
              <select
                value={motivoDevolucaoId}
                onChange={(e) => setMotivoDevolucaoId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="">Selecione...</option>
                {motivosDevolucao.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Observação (opcional)</label>
              <textarea
                value={observacaoDevolucao}
                onChange={(e) => setObservacaoDevolucao(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>

            {erroDevolucao && <p className="text-sm text-danger">{erroDevolucao}</p>}

            <Button
              onClick={registrarDevolucao}
              disabled={!bolsaDevolucao || !motivoDevolucaoId || salvandoDevolucao}
            >
              {salvandoDevolucao ? "Registrando..." : "Registrar Devolução"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-medium">Novo Descarte</h2>
          <div className="space-y-4">
            <BuscaBolsa
              termo={termoBolsaDescarte}
              onTermoChange={(valor) => {
                setTermoBolsaDescarte(valor);
                setBolsaDescarte(null);
              }}
              resultados={resultadosBolsaDescarte}
              buscando={buscandoBolsaDescarte}
              selecionada={bolsaDescarte}
              onSelecionar={setBolsaDescarte}
            />

            <div>
              <label className="mb-1 block text-sm font-medium">Motivo</label>
              <select
                value={motivoDescarteId}
                onChange={(e) => setMotivoDescarteId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="">Selecione...</option>
                {motivosDescarte.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Observação (opcional)</label>
              <textarea
                value={observacaoDescarte}
                onChange={(e) => setObservacaoDescarte(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>

            {erroDescarte && <p className="text-sm text-danger">{erroDescarte}</p>}

            <Button onClick={registrarDescarte} disabled={!bolsaDescarte || !motivoDescarteId || salvandoDescarte}>
              {salvandoDescarte ? "Registrando..." : "Registrar Descarte"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <h2 className="px-4 pt-4 text-lg font-medium">Histórico de Devoluções</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Bolsa</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {carregandoHistorico ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Carregando...
                  </td>
                </tr>
              ) : erroHistorico ? (
                <tr>
                  <td className="px-4 py-6 text-center text-danger" colSpan={3}>
                    {erroHistorico}
                  </td>
                </tr>
              ) : devolucoes.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Nenhuma devolução registrada.
                  </td>
                </tr>
              ) : (
                devolucoes.map((d) => (
                  <tr key={d.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3">{mapaBolsas.get(d.unidade_hemocomponente_id) ?? "—"}</td>
                    <td className="px-4 py-3">{mapaMotivosDevolucao.get(d.motivo_devolucao_id) ?? "—"}</td>
                    <td className="px-4 py-3">{formatarDataHora(d.data_devolucao)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-0">
          <h2 className="px-4 pt-4 text-lg font-medium">Histórico de Descartes</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Bolsa</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {carregandoHistorico ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Carregando...
                  </td>
                </tr>
              ) : erroHistorico ? (
                <tr>
                  <td className="px-4 py-6 text-center text-danger" colSpan={3}>
                    {erroHistorico}
                  </td>
                </tr>
              ) : descartes.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={3}>
                    Nenhum descarte registrado.
                  </td>
                </tr>
              ) : (
                descartes.map((d) => (
                  <tr key={d.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3">{mapaBolsas.get(d.unidade_hemocomponente_id) ?? "—"}</td>
                    <td className="px-4 py-3">{mapaMotivosDescarte.get(d.motivo_descarte_id) ?? "—"}</td>
                    <td className="px-4 py-3">{formatarDataHora(d.data_descarte)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
