import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * HemoGest — Parametrizações.
 * Seis sub-recursos quase idênticos (Setores, Hemocomponentes, Motivos de
 * Devolução/Descarte, Tipos de Reação, Gravidades). Em vez de repetir a
 * mesma tela seis vezes, um único componente genérico (`AbaParametrizacao`)
 * é configurado por `AbaConfig` — cada aba só declara os campos que tem.
 */

type TipoCampo = "texto" | "numero";

interface CampoConfig {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  largoTotal?: boolean;
}

interface AbaConfig {
  chave: string;
  titulo: string;
  tituloSingular: string;
  endpoint: string;
  temOrdem: boolean;
  campos: CampoConfig[];
}

interface ItemGenerico {
  id: string;
  nome: string;
  ativo: boolean;
  ordem?: number;
  [chave: string]: unknown;
}

const CAMPOS_BASE: CampoConfig[] = [
  { chave: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxLength: 120 },
  { chave: "descricao", rotulo: "Descrição", tipo: "texto", maxLength: 255, largoTotal: true },
  { chave: "cor", rotulo: "Cor (hex)", tipo: "texto", maxLength: 7, placeholder: "#RRGGBB" },
  { chave: "ordem", rotulo: "Ordem", tipo: "numero" },
];

const ABAS: AbaConfig[] = [
  {
    chave: "setores",
    titulo: "Setores",
    tituloSingular: "Setor",
    endpoint: "/setores",
    temOrdem: false,
    campos: [
      { chave: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, maxLength: 120 },
      { chave: "sigla", rotulo: "Sigla", tipo: "texto", maxLength: 20 },
    ],
  },
  {
    chave: "hemocomponentes",
    titulo: "Hemocomponentes",
    tituloSingular: "Hemocomponente",
    endpoint: "/hemocomponentes",
    temOrdem: true,
    campos: [
      ...CAMPOS_BASE,
      { chave: "sigla", rotulo: "Sigla", tipo: "texto", maxLength: 10 },
      { chave: "validade_padrao_dias", rotulo: "Validade Padrão (dias)", tipo: "numero", min: 1 },
    ],
  },
  {
    chave: "motivos-devolucao",
    titulo: "Motivos de Devolução/Descarte",
    tituloSingular: "Motivo de Devolução/Descarte",
    endpoint: "/motivos-devolucao",
    temOrdem: true,
    campos: CAMPOS_BASE,
  },
  {
    chave: "tipos-reacao",
    titulo: "Tipos de Reação",
    tituloSingular: "Tipo de Reação",
    endpoint: "/tipos-reacao",
    temOrdem: true,
    campos: CAMPOS_BASE,
  },
  {
    chave: "gravidades",
    titulo: "Gravidades",
    tituloSingular: "Gravidade",
    endpoint: "/gravidades",
    temOrdem: true,
    campos: [...CAMPOS_BASE, { chave: "nivel", rotulo: "Nível (1-10)", tipo: "numero", obrigatorio: true, min: 1, max: 10 }],
  },
];

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formVazio(config: AbaConfig): Record<string, string> {
  const form: Record<string, string> = {};
  for (const campo of config.campos) {
    form[campo.chave] = campo.chave === "ordem" ? "0" : "";
  }
  return form;
}

function AbaParametrizacao({ config }: { config: AbaConfig }) {
  const [itens, setItens] = useState<ItemGenerico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ItemGenerico | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => formVazio(config));
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    setErroLista(null);
    api
      .get<ItemGenerico[]>(config.endpoint)
      .then(setItens)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar os itens.")))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.endpoint]);

  function abrirCriacao() {
    setEditando(null);
    setForm(formVazio(config));
    setAtivo(true);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(item: ItemGenerico) {
    const preenchido: Record<string, string> = {};
    for (const campo of config.campos) {
      const valor = item[campo.chave];
      preenchido[campo.chave] = valor === null || valor === undefined ? "" : String(valor);
    }
    setEditando(item);
    setForm(preenchido);
    setAtivo(item.ativo);
    setErroForm(null);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditando(null);
    setErroForm(null);
  }

  function montarPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const campo of config.campos) {
      const bruto = (form[campo.chave] ?? "").trim();
      if (campo.tipo === "numero") {
        payload[campo.chave] = bruto === "" ? null : Number(bruto);
      } else {
        payload[campo.chave] = bruto === "" ? null : bruto;
      }
    }
    if (editando) payload.ativo = ativo;
    return payload;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const payload = montarPayload();
      if (editando) {
        await api.put(`${config.endpoint}/${editando.id}`, payload);
      } else {
        await api.post(config.endpoint, payload);
      }
      fecharForm();
      carregar();
    } catch (err) {
      setErroForm(mensagemErro(err, `Não foi possível salvar ${config.tituloSingular.toLowerCase()}.`));
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(item: ItemGenerico) {
    if (!window.confirm(`Excluir "${item.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`${config.endpoint}/${item.id}`);
      carregar();
    } catch (err) {
      setErroLista(mensagemErro(err, "Não foi possível excluir o item."));
    }
  }

  const colunas = config.temOrdem ? 4 : 3;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{config.titulo}</h2>
        <Button onClick={abrirCriacao} className="flex items-center gap-2">
          <Plus size={16} />
          Novo
        </Button>
      </div>

      {formAberto && (
        <Card>
          <h3 className="mb-4 text-base font-medium">
            {editando ? `Editar ${config.tituloSingular}` : `Novo — ${config.tituloSingular}`}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {config.campos.map((campo) => (
              <div key={campo.chave} className={campo.largoTotal ? "sm:col-span-2" : undefined}>
                <label className="mb-1 block text-sm font-medium">{campo.rotulo}</label>
                <input
                  type={campo.tipo === "numero" ? "number" : "text"}
                  required={campo.obrigatorio}
                  maxLength={campo.maxLength}
                  min={campo.min}
                  max={campo.max}
                  placeholder={campo.placeholder}
                  value={form[campo.chave] ?? ""}
                  onChange={(e) => setForm({ ...form, [campo.chave]: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                />
              </div>
            ))}

            {editando && (
              <div className="flex items-center gap-2">
                <input
                  id={`ativo-${config.chave}`}
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor={`ativo-${config.chave}`} className="text-sm font-medium">
                  Ativo
                </label>
              </div>
            )}

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

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              {config.temOrdem && <th className="px-4 py-3 font-medium">Ordem</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={colunas}>
                  Carregando...
                </td>
              </tr>
            ) : erroLista ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={colunas}>
                  {erroLista}
                </td>
              </tr>
            ) : itens.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={colunas}>
                  Nenhum item cadastrado.
                </td>
              </tr>
            ) : (
              itens.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">{item.nome}</td>
                  {config.temOrdem && <td className="px-4 py-3">{String(item.ordem ?? 0)}</td>}
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.ativo
                          ? "inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                          : "inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
                      }
                    >
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEdicao(item)}
                        className="text-ink-muted hover:text-hemo"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleExcluir(item)}
                        className="text-ink-muted hover:text-danger"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

export function ParametrizacoesPage() {
  const [abaAtiva, setAbaAtiva] = useState(ABAS[0].chave);
  const config = ABAS.find((a) => a.chave === abaAtiva) ?? ABAS[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Parametrizações</h1>

      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        {ABAS.map((aba) => (
          <button
            key={aba.chave}
            onClick={() => setAbaAtiva(aba.chave)}
            className={clsx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              aba.chave === abaAtiva
                ? "border-hemo text-hemo"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {aba.titulo}
          </button>
        ))}
      </div>

      <AbaParametrizacao key={config.chave} config={config} />
    </div>
  );
}
