import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Mapa de trabalho pré-transfusional (módulo opcional, ver MODULOS.md)
 * — ficha técnica de laboratório para UMA bolsa já registrada, arquivada
 * junto com a solicitação. Complementa os campos mínimos que já existem em
 * SolicitacaoBolsa (prova_cruzada, responsavel_testes) com o detalhe que um
 * laboratório que faz os próprios testes pré-transfusionais precisa
 * registrar (lotes de reagente, técnica usada, dupla checagem).
 */

const TIPOS_SANGUINEOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const TECNICAS = ["TUBO", "GEL", "OUTRO"];

interface Solicitacao {
  id: string;
  paciente_nome: string;
  bolsas: { id: string; numero_bolsa: string }[];
}

interface MapaTrabalho {
  id: string;
  solicitacao_bolsa_id: string;
  abo_rh_receptor_confirmado: string | null;
  abo_rh_doador_confirmado: string | null;
  metodo_abo_rh: string | null;
  tecnica_prova_cruzada: string | null;
  lote_reagente_pai: string | null;
  lote_soro_anti_a: string | null;
  lote_soro_anti_b: string | null;
  lote_soro_anti_d: string | null;
  validade_reagentes: string | null;
  temperatura_amostra_c: number | null;
  data_hora_inicio: string | null;
  data_hora_fim: string | null;
  observacoes: string | null;
}

type FormState = {
  abo_rh_receptor_confirmado: string;
  abo_rh_doador_confirmado: string;
  metodo_abo_rh: string;
  tecnica_prova_cruzada: string;
  lote_reagente_pai: string;
  lote_soro_anti_a: string;
  lote_soro_anti_b: string;
  lote_soro_anti_d: string;
  validade_reagentes: string;
  temperatura_amostra_c: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  observacoes: string;
};

const VAZIO: FormState = {
  abo_rh_receptor_confirmado: "", abo_rh_doador_confirmado: "", metodo_abo_rh: "", tecnica_prova_cruzada: "",
  lote_reagente_pai: "", lote_soro_anti_a: "", lote_soro_anti_b: "", lote_soro_anti_d: "",
  validade_reagentes: "", temperatura_amostra_c: "", data_hora_inicio: "", data_hora_fim: "", observacoes: "",
};

function paraFormulario(m: MapaTrabalho | null): FormState {
  if (!m) return VAZIO;
  return {
    abo_rh_receptor_confirmado: m.abo_rh_receptor_confirmado ?? "",
    abo_rh_doador_confirmado: m.abo_rh_doador_confirmado ?? "",
    metodo_abo_rh: m.metodo_abo_rh ?? "",
    tecnica_prova_cruzada: m.tecnica_prova_cruzada ?? "",
    lote_reagente_pai: m.lote_reagente_pai ?? "",
    lote_soro_anti_a: m.lote_soro_anti_a ?? "",
    lote_soro_anti_b: m.lote_soro_anti_b ?? "",
    lote_soro_anti_d: m.lote_soro_anti_d ?? "",
    validade_reagentes: m.validade_reagentes ?? "",
    temperatura_amostra_c: m.temperatura_amostra_c?.toString() ?? "",
    data_hora_inicio: m.data_hora_inicio?.slice(0, 16) ?? "",
    data_hora_fim: m.data_hora_fim?.slice(0, 16) ?? "",
    observacoes: m.observacoes ?? "",
  };
}

const campo =
  "w-full rounded-lg border border-neutral-300 bg-surface-card px-3 py-2 text-sm focus:border-hemo focus:outline-none print:border-0 print:p-0";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{rotulo}</label>
      {children}
    </div>
  );
}

export function MapaTrabalhoPreTransfusionalPage() {
  const { id, bolsaId } = useParams();
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);

  useEffect(() => {
    api
      .get<Solicitacao>(`/solicitacoes/${id}`)
      .then((s) => {
        if (!s.bolsas.find((b) => b.id === bolsaId)) {
          setErro("Essa bolsa não foi encontrada nesta solicitação.");
          return;
        }
        setSolicitacao(s);
        document.title = `Mapa de trabalho — ${s.paciente_nome}`;
      })
      .catch((err) =>
        setErro(
          err instanceof ApiError && err.status === 403
            ? "O módulo de mapa de trabalho não está ativo para esta unidade."
            : err instanceof ApiError && err.status === 404
              ? "Solicitação não encontrada."
              : "Não foi possível abrir o mapa de trabalho.",
        ),
      );
    api
      .get<MapaTrabalho | null>(`/solicitacoes/${id}/bolsas/${bolsaId}/mapa-trabalho`)
      .then((m) => setForm(paraFormulario(m)))
      .catch(() => undefined);
  }, [id, bolsaId]);

  function definir(parcial: Partial<FormState>) {
    setForm((atual) => ({ ...atual, ...parcial }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/solicitacoes/${id}/bolsas/${bolsaId}/mapa-trabalho`, {
        abo_rh_receptor_confirmado: form.abo_rh_receptor_confirmado || null,
        abo_rh_doador_confirmado: form.abo_rh_doador_confirmado || null,
        metodo_abo_rh: form.metodo_abo_rh || null,
        tecnica_prova_cruzada: form.tecnica_prova_cruzada || null,
        lote_reagente_pai: form.lote_reagente_pai || null,
        lote_soro_anti_a: form.lote_soro_anti_a || null,
        lote_soro_anti_b: form.lote_soro_anti_b || null,
        lote_soro_anti_d: form.lote_soro_anti_d || null,
        validade_reagentes: form.validade_reagentes || null,
        temperatura_amostra_c: form.temperatura_amostra_c ? Number(form.temperatura_amostra_c) : null,
        data_hora_inicio: form.data_hora_inicio || null,
        data_hora_fim: form.data_hora_fim || null,
        observacoes: form.observacoes || null,
      });
      setSalvoEm(new Date());
    } catch (err) {
      setErro(
        err instanceof ApiError && err.status === 403
          ? "O módulo de mapa de trabalho não está ativo para esta unidade."
          : "Não foi possível salvar o mapa de trabalho.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const bolsa = solicitacao?.bolsas.find((b) => b.id === bolsaId);

  return (
    <div className="min-h-screen bg-surface-bg px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center gap-2 print:hidden">
        <Link to="/solicitacoes" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-neutral-100">
          <ArrowLeft size={16} /> Solicitações
        </Link>
        <div className="flex-1" />
        <Button type="button" variant="secondary" onClick={() => window.print()} disabled={!solicitacao} className="flex items-center gap-2">
          <Printer size={16} />
          Imprimir / arquivar
        </Button>
      </div>

      {erro && <p className="mx-auto max-w-[210mm] rounded-lg bg-white p-4 text-danger">{erro}</p>}
      {!erro && !solicitacao && <p className="mx-auto max-w-[210mm] text-ink-muted">Carregando...</p>}

      {solicitacao && bolsa && (
        <Card className="mx-auto max-w-[210mm] space-y-5 print:border-0 print:shadow-none">
          <div>
            <h1 className="text-lg font-semibold">Mapa de trabalho pré-transfusional</h1>
            <p className="text-sm text-ink-muted">
              {solicitacao.paciente_nome} · Bolsa {bolsa.numero_bolsa}
            </p>
          </div>

          <form onSubmit={salvar} className="space-y-5">
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Confirmação ABO/Rh</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Campo rotulo="ABO/Rh do receptor (confirmado)">
                  <select className={campo} value={form.abo_rh_receptor_confirmado} onChange={(e) => definir({ abo_rh_receptor_confirmado: e.target.value })}>
                    <option value="">—</option>
                    {TIPOS_SANGUINEOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="ABO/Rh do doador (confirmado)">
                  <select className={campo} value={form.abo_rh_doador_confirmado} onChange={(e) => definir({ abo_rh_doador_confirmado: e.target.value })}>
                    <option value="">—</option>
                    {TIPOS_SANGUINEOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Método ABO/Rh">
                  <select className={campo} value={form.metodo_abo_rh} onChange={(e) => definir({ metodo_abo_rh: e.target.value })}>
                    <option value="">—</option>
                    {TECNICAS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Prova cruzada e PAI</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo rotulo="Técnica da prova cruzada">
                  <select className={campo} value={form.tecnica_prova_cruzada} onChange={(e) => definir({ tecnica_prova_cruzada: e.target.value })}>
                    <option value="">—</option>
                    {TECNICAS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Lote do reagente (PAI)">
                  <input className={campo} value={form.lote_reagente_pai} onChange={(e) => definir({ lote_reagente_pai: e.target.value })} />
                </Campo>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Reagentes e amostra</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Campo rotulo="Lote soro anti-A"><input className={campo} value={form.lote_soro_anti_a} onChange={(e) => definir({ lote_soro_anti_a: e.target.value })} /></Campo>
                <Campo rotulo="Lote soro anti-B"><input className={campo} value={form.lote_soro_anti_b} onChange={(e) => definir({ lote_soro_anti_b: e.target.value })} /></Campo>
                <Campo rotulo="Lote soro anti-D"><input className={campo} value={form.lote_soro_anti_d} onChange={(e) => definir({ lote_soro_anti_d: e.target.value })} /></Campo>
                <Campo rotulo="Validade dos reagentes">
                  <input type="date" className={campo} value={form.validade_reagentes} onChange={(e) => definir({ validade_reagentes: e.target.value })} />
                </Campo>
                <Campo rotulo="Temperatura da amostra (°C)">
                  <input type="number" step="0.1" className={campo} value={form.temperatura_amostra_c} onChange={(e) => definir({ temperatura_amostra_c: e.target.value })} />
                </Campo>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Execução</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo rotulo="Início">
                  <input type="datetime-local" className={campo} value={form.data_hora_inicio} onChange={(e) => definir({ data_hora_inicio: e.target.value })} />
                </Campo>
                <Campo rotulo="Término">
                  <input type="datetime-local" className={campo} value={form.data_hora_fim} onChange={(e) => definir({ data_hora_fim: e.target.value })} />
                </Campo>
              </div>
              <Campo rotulo="Observações">
                <textarea className={campo} rows={3} value={form.observacoes} onChange={(e) => definir({ observacoes: e.target.value })} />
              </Campo>
            </section>

            <div className="flex items-center gap-3 print:hidden">
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
              {salvoEm && <span className="text-sm text-ink-muted">Salvo às {salvoEm.toLocaleTimeString("pt-BR")}.</span>}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
