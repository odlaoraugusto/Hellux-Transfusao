import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Solicitação de bolsas ao hemocentro de referência (módulo opcional, ver
 * MODULOS.md) — fluxo inverso do formulário público: a agência pede
 * reposição de estoque, em vez de o setor pedir pra agência. Só aparece
 * pra unidades com modulo_solicitacao_hemocentro_ativo.
 */

type Status = "SOLICITADA" | "ENVIADA" | "RECEBIDA" | "CANCELADA";

interface Item {
  id: string;
  hemocomponente_id: string;
  quantidade_solicitada: number;
}

interface SolicitacaoHemocentro {
  id: string;
  hemocentro_nome: string | null;
  status: Status;
  data_solicitacao: string;
  data_envio: string | null;
  data_recebimento: string | null;
  observacoes: string | null;
  itens: Item[];
}

interface Hemocomponente {
  id: string;
  nome: string;
  sigla: string | null;
}

const TIPOS_SANGUINEOS = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const campo =
  "w-full rounded-lg border border-neutral-300 bg-surface-card px-3 py-2 text-sm focus:border-hemo focus:outline-none";

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString("pt-BR");
}

const STATUS_ROTULO: Record<Status, string> = {
  SOLICITADA: "Solicitada", ENVIADA: "Enviada", RECEBIDA: "Recebida", CANCELADA: "Cancelada",
};

export function SolicitacaoHemocentroPage() {
  const { unidadeAtivaId } = useAuth();
  const [lista, setLista] = useState<SolicitacaoHemocentro[]>([]);
  const [catalogo, setCatalogo] = useState<Hemocomponente[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [recebendoId, setRecebendoId] = useState<string | null>(null);

  function carregar() {
    api
      .get<SolicitacaoHemocentro[]>("/solicitacoes-hemocentro")
      .then(setLista)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar as solicitações ao hemocentro.")));
  }

  useEffect(() => {
    if (!unidadeAtivaId) return;
    carregar();
    api.get<Hemocomponente[]>("/hemocomponentes").then(setCatalogo).catch(() => undefined);
  }, [unidadeAtivaId]);

  function nomeHemocomponente(id: string): string {
    const h = catalogo.find((c) => c.id === id);
    return h ? (h.sigla ? `${h.nome} (${h.sigla})` : h.nome) : id;
  }

  async function marcarEnviada(id: string) {
    try {
      await api.post(`/solicitacoes-hemocentro/${id}/marcar-enviada`);
      carregar();
    } catch (err) {
      setErroLista(mensagemErro(err, "Não foi possível marcar como enviada."));
    }
  }

  async function cancelar(id: string) {
    const motivo = window.prompt("Motivo do cancelamento:");
    if (!motivo || motivo.trim().length < 3) return;
    try {
      await api.post(`/solicitacoes-hemocentro/${id}/cancelar`, { motivo });
      carregar();
    } catch (err) {
      setErroLista(mensagemErro(err, "Não foi possível cancelar a solicitação."));
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver as solicitações ao hemocentro.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Truck size={22} className="text-hemo" /> Solicitação ao Hemocentro
          </h1>
          <p className="text-sm text-ink-muted">Reposição de estoque junto ao hemocentro de referência.</p>
        </div>
        <Button onClick={() => setFormAberto((v) => !v)} className="flex items-center gap-2">
          <Plus size={16} /> Nova solicitação
        </Button>
      </div>

      {erroLista && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{erroLista}</p>}

      {formAberto && (
        <FormNovaSolicitacao
          catalogo={catalogo}
          onCancelar={() => setFormAberto(false)}
          onCriada={() => {
            setFormAberto(false);
            carregar();
          }}
        />
      )}

      <div className="space-y-3">
        {lista.length === 0 && !erroLista && <p className="text-ink-muted">Nenhuma solicitação ao hemocentro ainda.</p>}
        {lista.map((s) => (
          <Card key={s.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.hemocentro_nome ?? "Hemocentro não informado"}</p>
                <p className="text-xs text-ink-muted">Solicitada em {formatarDataHora(s.data_solicitacao)}</p>
              </div>
              <Badge status={s.status}>{STATUS_ROTULO[s.status]}</Badge>
            </div>

            <ul className="space-y-1 text-sm">
              {s.itens.map((item) => (
                <li key={item.id}>
                  {item.quantidade_solicitada}× {nomeHemocomponente(item.hemocomponente_id)}
                </li>
              ))}
            </ul>

            {s.observacoes && <p className="whitespace-pre-wrap text-sm text-ink-muted">{s.observacoes}</p>}

            {s.data_envio && <p className="text-xs text-ink-muted">Enviada em {formatarDataHora(s.data_envio)}</p>}
            {s.data_recebimento && (
              <p className="text-xs text-ink-muted">Recebida em {formatarDataHora(s.data_recebimento)}</p>
            )}

            {(s.status === "SOLICITADA" || s.status === "ENVIADA") && (
              <div className="flex items-center gap-2 border-t border-neutral-200 pt-3">
                {s.status === "SOLICITADA" && (
                  <Button variant="secondary" onClick={() => marcarEnviada(s.id)}>
                    Marcar como enviada
                  </Button>
                )}
                <Button onClick={() => setRecebendoId(recebendoId === s.id ? null : s.id)}>
                  Registrar recebimento
                </Button>
                <Button variant="ghost" onClick={() => cancelar(s.id)}>
                  Cancelar
                </Button>
              </div>
            )}

            {recebendoId === s.id && (
              <FormReceber
                solicitacao={s}
                catalogo={catalogo}
                onCancelar={() => setRecebendoId(null)}
                onRecebida={() => {
                  setRecebendoId(null);
                  carregar();
                }}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

interface ItemForm {
  hemocomponente_id: string;
  quantidade_solicitada: string;
}

function FormNovaSolicitacao({
  catalogo,
  onCancelar,
  onCriada,
}: {
  catalogo: Hemocomponente[];
  onCancelar: () => void;
  onCriada: () => void;
}) {
  const [hemocentroNome, setHemocentroNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([{ hemocomponente_id: "", quantidade_solicitada: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function definirItem(indice: number, parcial: Partial<ItemForm>) {
    setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, ...parcial } : it)));
  }

  function adicionarItem() {
    setItens((atual) => [...atual, { hemocomponente_id: "", quantidade_solicitada: "" }]);
  }

  function removerItem(indice: number) {
    setItens((atual) => atual.filter((_, i) => i !== indice));
  }

  const valido = itens.length > 0 && itens.every((it) => it.hemocomponente_id && Number(it.quantidade_solicitada) >= 1);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.post("/solicitacoes-hemocentro", {
        hemocentro_nome: hemocentroNome || null,
        observacoes: observacoes || null,
        itens: itens.map((it) => ({
          hemocomponente_id: it.hemocomponente_id,
          quantidade_solicitada: Number(it.quantidade_solicitada),
        })),
      });
      onCriada();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível criar a solicitação."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <form onSubmit={salvar} className="space-y-4">
        <h2 className="text-lg font-medium">Nova solicitação ao hemocentro</h2>
        {erro && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{erro}</p>}

        <div>
          <label className="mb-1 block text-sm font-medium">Hemocentro</label>
          <input className={campo} value={hemocentroNome} onChange={(e) => setHemocentroNome(e.target.value)} placeholder="Ex: Hemocentro Estadual de Referência" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Itens solicitados</label>
          {itens.map((item, indice) => (
            <div key={indice} className="flex items-center gap-2">
              <select
                required
                className={campo}
                value={item.hemocomponente_id}
                onChange={(e) => definirItem(indice, { hemocomponente_id: e.target.value })}
              >
                <option value="">Hemocomponente...</option>
                {catalogo.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.sigla ? `${h.nome} (${h.sigla})` : h.nome}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min={1}
                max={200}
                placeholder="Qtd."
                className={`${campo} max-w-[7rem]`}
                value={item.quantidade_solicitada}
                onChange={(e) => definirItem(indice, { quantidade_solicitada: e.target.value })}
              />
              {itens.length > 1 && (
                <button type="button" onClick={() => removerItem(indice)} className="p-1 text-ink-muted hover:text-danger">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={adicionarItem} className="flex items-center gap-1 text-sm text-hemo hover:underline">
            <Plus size={14} /> Adicionar item
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Observações</label>
          <textarea className={campo} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={salvando || !valido}>
            {salvando ? "Salvando..." : "Criar solicitação"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface BolsaRecebidaForm {
  hemocomponente_id: string;
  numero_bolsa: string;
  numero_macarrao: string;
  tipo_sanguineo: string;
  data_coleta: string;
  data_validade: string;
}

function novaBolsaForm(hemocomponenteId = ""): BolsaRecebidaForm {
  return { hemocomponente_id: hemocomponenteId, numero_bolsa: "", numero_macarrao: "", tipo_sanguineo: "", data_coleta: "", data_validade: "" };
}

function FormReceber({
  solicitacao,
  catalogo,
  onCancelar,
  onRecebida,
}: {
  solicitacao: SolicitacaoHemocentro;
  catalogo: Hemocomponente[];
  onCancelar: () => void;
  onRecebida: () => void;
}) {
  const [bolsas, setBolsas] = useState<BolsaRecebidaForm[]>([novaBolsaForm(solicitacao.itens[0]?.hemocomponente_id)]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function definirBolsa(indice: number, parcial: Partial<BolsaRecebidaForm>) {
    setBolsas((atual) => atual.map((b, i) => (i === indice ? { ...b, ...parcial } : b)));
  }

  function adicionarBolsa() {
    setBolsas((atual) => [...atual, novaBolsaForm(solicitacao.itens[0]?.hemocomponente_id)]);
  }

  function removerBolsa(indice: number) {
    setBolsas((atual) => atual.filter((_, i) => i !== indice));
  }

  const valido =
    bolsas.length > 0 &&
    bolsas.every((b) => b.hemocomponente_id && b.numero_bolsa.trim() && b.data_validade);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/solicitacoes-hemocentro/${solicitacao.id}/receber`, {
        bolsas: bolsas.map((b) => ({
          hemocomponente_id: b.hemocomponente_id,
          numero_bolsa: b.numero_bolsa,
          numero_macarrao: b.numero_macarrao || null,
          tipo_sanguineo: b.tipo_sanguineo || null,
          data_coleta: b.data_coleta || null,
          data_validade: b.data_validade,
        })),
      });
      onRecebida();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível registrar o recebimento."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-3 border-t border-neutral-200 pt-3">
      <p className="text-sm font-medium">Bolsas recebidas (cada uma já entra no estoque)</p>
      {erro && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
      {bolsas.map((b, indice) => (
        <div key={indice} className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-3">
          <select className={campo} value={b.hemocomponente_id} onChange={(e) => definirBolsa(indice, { hemocomponente_id: e.target.value })}>
            <option value="">Hemocomponente...</option>
            {catalogo.map((h) => (
              <option key={h.id} value={h.id}>{h.sigla ? `${h.nome} (${h.sigla})` : h.nome}</option>
            ))}
          </select>
          <input placeholder="Nº da bolsa" className={campo} value={b.numero_bolsa} onChange={(e) => definirBolsa(indice, { numero_bolsa: e.target.value })} />
          <input placeholder="Nº macarrão" className={campo} value={b.numero_macarrao} onChange={(e) => definirBolsa(indice, { numero_macarrao: e.target.value })} />
          <select className={campo} value={b.tipo_sanguineo} onChange={(e) => definirBolsa(indice, { tipo_sanguineo: e.target.value })}>
            {TIPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t || "ABO/Rh..."}</option>)}
          </select>
          <input type="date" placeholder="Coleta" className={campo} value={b.data_coleta} onChange={(e) => definirBolsa(indice, { data_coleta: e.target.value })} />
          <div className="flex items-center gap-2">
            <input required type="date" className={campo} value={b.data_validade} onChange={(e) => definirBolsa(indice, { data_validade: e.target.value })} />
            {bolsas.length > 1 && (
              <button type="button" onClick={() => removerBolsa(indice)} className="p-1 text-ink-muted hover:text-danger">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={adicionarBolsa} className="flex items-center gap-1 text-sm text-hemo hover:underline">
        <Plus size={14} /> Adicionar bolsa
      </button>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={salvando || !valido}>
          {salvando ? "Salvando..." : "Confirmar recebimento"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
