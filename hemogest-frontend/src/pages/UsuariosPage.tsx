import { useEffect, useState, type FormEvent } from "react";
import { Ban, Pencil, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Role, Usuario, UnidadeHospitalar } from "@/types";

interface FormState {
  nome: string;
  email: string;
  role_id: string;
  unidade_hospitalar_id: string;
  ativo: boolean;
}

const FORM_VAZIO: FormState = {
  nome: "",
  email: "",
  role_id: "",
  unidade_hospitalar_id: "",
  ativo: true,
};

function paraFormulario(u: Usuario): FormState {
  return {
    nome: u.nome,
    email: u.email,
    role_id: u.role_id,
    unidade_hospitalar_id: u.unidade_hospitalar_id ?? "",
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

function formatarData(data: string | null): string {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR");
}

export function UsuariosPage() {
  const { usuario } = useAuth();
  const isAdminGlobal = usuario?.unidade_hospitalar_id === null;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [aviso, setAviso] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    setErroLista(null);

    const requisicoes: Promise<unknown>[] = [
      api.get<Usuario[]>("/usuarios").then(setUsuarios),
      api
        .get<Role[]>("/roles")
        .then(setRoles)
        .catch(() => setRoles([])),
    ];

    if (isAdminGlobal) {
      requisicoes.push(
        api
          .get<UnidadeHospitalar[]>("/unidades-hospitalares")
          .then(setUnidades)
          .catch(() => setUnidades([])),
      );
    }

    Promise.all(requisicoes)
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar os usuários.")))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  function resolverNomeRole(roleId: string): string {
    return roles.find((r) => r.id === roleId)?.nome_exibicao ?? "—";
  }

  function resolverNomeUnidade(unidadeId: string | null): string {
    if (!unidadeId) return "—";
    return unidades.find((u) => u.id === unidadeId)?.nome_fantasia ?? "—";
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setAviso(null);
    setFormAberto(true);
  }

  function abrirEdicao(u: Usuario) {
    setEditando(u);
    setForm(paraFormulario(u));
    setErroForm(null);
    setAviso(null);
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
        const payload: Record<string, unknown> = {
          nome: form.nome,
          role_id: form.role_id,
          ativo: form.ativo,
        };
        if (isAdminGlobal) {
          payload.unidade_hospitalar_id = form.unidade_hospitalar_id || null;
        }
        await api.put(`/usuarios/${editando.id}`, payload);
        fecharForm();
      } else {
        // Unidade não aparece no formulário para perfis não-admin: a
        // unidade do novo usuário é implicitamente a do próprio criador.
        const unidadeParaEnviar = isAdminGlobal
          ? form.unidade_hospitalar_id || null
          : (usuario?.unidade_hospitalar_id ?? null);
        await api.post("/usuarios", {
          nome: form.nome,
          email: form.email,
          role_id: form.role_id,
          unidade_hospitalar_id: unidadeParaEnviar,
        });
        setFormAberto(false);
        setEditando(null);
        setAviso(
          "Usuário criado. O acesso inicial depende de um fluxo de definição de senha ainda não integrado ao e-mail — funcionalidade pendente no backend.",
        );
      }
      carregar();
    } catch (err) {
      setErroForm(mensagemErro(err, "Não foi possível salvar o usuário."));
    } finally {
      setSalvando(false);
    }
  }

  async function handleDesativar(u: Usuario) {
    if (!window.confirm(`Desativar o acesso de "${u.nome}"? O usuário deixará de conseguir entrar no sistema.`)) return;
    try {
      await api.delete(`/usuarios/${u.id}`);
      carregar();
    } catch (err) {
      setErroLista(mensagemErro(err, "Não foi possível desativar o usuário."));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <Button onClick={abrirCriacao} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Usuário
        </Button>
      </div>

      {aviso && (
        <Card className="border-hemo/30 bg-hemo/5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-ink">{aviso}</p>
            <button onClick={() => setAviso(null)} className="text-sm font-medium text-hemo hover:underline">
              Ok
            </button>
          </div>
        </Card>
      )}

      {formAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">{editando ? "Editar Usuário" : "Novo Usuário"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <input
                required
                minLength={2}
                maxLength={150}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                required
                type="email"
                disabled={!!editando}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none disabled:bg-neutral-100 disabled:text-ink-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Perfil</label>
              <select
                required
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome_exibicao}
                  </option>
                ))}
              </select>
            </div>
            {isAdminGlobal && (
              <div>
                <label className="mb-1 block text-sm font-medium">Unidade Hospitalar</label>
                <select
                  value={form.unidade_hospitalar_id}
                  onChange={(e) => setForm({ ...form, unidade_hospitalar_id: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
                >
                  <option value="">— Nenhuma (Administrador Global) —</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome_fantasia}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                  Usuário ativo
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
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              {isAdminGlobal && <th className="px-4 py-3 font-medium">Unidade</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={isAdminGlobal ? 7 : 6}>
                  Carregando...
                </td>
              </tr>
            ) : erroLista ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={isAdminGlobal ? 7 : 6}>
                  {erroLista}
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={isAdminGlobal ? 7 : 6}>
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    {u.nome}
                    {u.primeiro_acesso && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Primeiro acesso pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{resolverNomeRole(u.role_id)}</td>
                  {isAdminGlobal && <td className="px-4 py-3">{resolverNomeUnidade(u.unidade_hospitalar_id)}</td>}
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.ativo
                          ? "inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                          : "inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
                      }
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatarData(u.ultimo_login_em)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEdicao(u)}
                        className="text-ink-muted hover:text-hemo"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      {u.ativo && (
                        <button
                          onClick={() => handleDesativar(u)}
                          className="text-ink-muted hover:text-danger"
                          title="Desativar"
                        >
                          <Ban size={16} />
                        </button>
                      )}
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
