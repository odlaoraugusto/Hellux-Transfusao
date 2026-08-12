import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UnidadeHospitalar } from "@/types";

interface FormState {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  codigo_cnes: string;
  endereco: string;
  cidade: string;
  uf: string;
  ativo: boolean;
}

const FORM_VAZIO: FormState = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  codigo_cnes: "",
  endereco: "",
  cidade: "",
  uf: "",
  ativo: true,
};

function paraFormulario(u: UnidadeHospitalar): FormState {
  return {
    razao_social: u.razao_social,
    nome_fantasia: u.nome_fantasia,
    cnpj: u.cnpj,
    codigo_cnes: u.codigo_cnes ?? "",
    endereco: u.endereco ?? "",
    cidade: u.cidade ?? "",
    uf: u.uf ?? "",
    ativo: u.ativo,
  };
}

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

export function UnidadeHospitalarPage() {
  const { usuario } = useAuth();
  const isAdminGlobal = usuario?.unidade_hospitalar_id === null;

  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<UnidadeHospitalar | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    setErroLista(null);
    const requisicao = isAdminGlobal
      ? api.get<UnidadeHospitalar[]>("/unidades-hospitalares")
      : usuario?.unidade_hospitalar_id
        ? api.get<UnidadeHospitalar>(`/unidades-hospitalares/${usuario.unidade_hospitalar_id}`).then((u) => [u])
        : Promise.resolve<UnidadeHospitalar[]>([]);

    requisicao
      .then(setUnidades)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar as unidades hospitalares.")))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(u: UnidadeHospitalar) {
    setEditando(u);
    setForm(paraFormulario(u));
    setErroForm(null);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditando(null);
    setErroForm(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/unidades-hospitalares/${editando.id}`, {
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          codigo_cnes: form.codigo_cnes || null,
          endereco: form.endereco || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          ativo: form.ativo,
        });
      } else {
        await api.post("/unidades-hospitalares", {
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj.replace(/\D/g, ""),
          codigo_cnes: form.codigo_cnes || null,
          endereco: form.endereco || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
        });
      }
      fecharForm();
      carregar();
    } catch (err) {
      setErroForm(mensagemErro(err, "Não foi possível salvar a unidade hospitalar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unidade Hospitalar</h1>
        {isAdminGlobal && (
          <Button onClick={abrirCriacao} className="flex items-center gap-2">
            <Plus size={16} />
            Nova Unidade
          </Button>
        )}
      </div>

      {formAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">{editando ? "Editar Unidade" : "Nova Unidade Hospitalar"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Razão Social</label>
              <input
                required
                minLength={2}
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nome Fantasia</label>
              <input
                required
                minLength={2}
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CNPJ</label>
              <input
                required
                disabled={!!editando}
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="Somente números"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none disabled:bg-neutral-100 disabled:text-ink-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Código CNES</label>
              <input
                value={form.codigo_cnes}
                onChange={(e) => setForm({ ...form, codigo_cnes: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Endereço</label>
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cidade</label>
              <input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">UF</label>
              <input
                maxLength={2}
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            {editando && (
              <div className="flex items-center gap-2">
                <input
                  id="ativo"
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="ativo" className="text-sm font-medium">
                  Unidade ativa
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
              <th className="px-4 py-3 font-medium">Nome Fantasia</th>
              <th className="px-4 py-3 font-medium">Razão Social</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
              <th className="px-4 py-3 font-medium">Cidade/UF</th>
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
            ) : unidades.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={6}>
                  Nenhuma unidade hospitalar cadastrada.
                </td>
              </tr>
            ) : (
              unidades.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">{u.nome_fantasia}</td>
                  <td className="px-4 py-3">{u.razao_social}</td>
                  <td className="px-4 py-3">{u.cnpj}</td>
                  <td className="px-4 py-3">{[u.cidade, u.uf].filter(Boolean).join("/") || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.ativo
                          ? "inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                          : "inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
                      }
                    >
                      {u.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirEdicao(u)}
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-hemo"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
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
