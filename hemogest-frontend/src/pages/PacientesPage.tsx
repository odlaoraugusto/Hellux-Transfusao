import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Paciente } from "@/types";

/**
 * Cadastro manual de paciente (2026-10-01, pedido do cliente: "teremos as
 * duas opções") — complementa o formulário público, que já cadastra o
 * paciente automaticamente na primeira solicitação. Aqui a equipe pode
 * cadastrar/editar direto, sem precisar de uma solicitação.
 */

interface FormState {
  nome: string;
  numero_prontuario: string;
  data_nascimento: string;
  sexo: "" | "M" | "F" | "I";
  cpf: string;
  cns: string;
  tipo_sanguineo: string;
  telefone: string;
  nome_mae: string;
}

const FORM_VAZIO: FormState = {
  nome: "",
  numero_prontuario: "",
  data_nascimento: "",
  sexo: "",
  cpf: "",
  cns: "",
  tipo_sanguineo: "",
  telefone: "",
  nome_mae: "",
};

const TIPOS_SANGUINEOS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function paraFormulario(p: Paciente): FormState {
  return {
    nome: p.nome,
    numero_prontuario: p.numero_prontuario ?? "",
    data_nascimento: p.data_nascimento ?? "",
    sexo: (p.sexo as FormState["sexo"]) ?? "",
    cpf: p.cpf ? mascararCpf(p.cpf) : "",
    cns: p.cns ? mascararCns(p.cns) : "",
    tipo_sanguineo: p.tipo_sanguineo ?? "",
    telefone: p.telefone ?? "",
    nome_mae: p.nome_mae ?? "",
  };
}

function somenteDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function mascararCpf(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 11);
  return digitos.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascararCns(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 15);
  return digitos.replace(/(\d{3})(\d)/, "$1 $2").replace(/(\d{4})(\d)/, "$1 $2").replace(/(\d{4})(\d{1,4})$/, "$1 $2");
}

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

const campo = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none";

export function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [termo, setTermo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const { unidadeAtivaId } = useAuth();

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Paciente | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function carregar() {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const query = termo ? `?termo=${encodeURIComponent(termo)}` : "";
    api
      .get<Paciente[]>(`/pacientes${query}`)
      .then((lista) => {
        setPacientes(lista);
        setErroLista(null);
      })
      .catch((err) => setErroLista(mensagemErro(err, "Não foi possível carregar os pacientes.")))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 300); // debounce simples de pesquisa
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, unidadeAtivaId]);

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(p: Paciente) {
    setEditando(p);
    setForm(paraFormulario(p));
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
      const payload = {
        nome: form.nome,
        numero_prontuario: form.numero_prontuario || null,
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        cpf: form.cpf ? somenteDigitos(form.cpf) : null,
        cns: form.cns ? somenteDigitos(form.cns) : null,
        tipo_sanguineo: form.tipo_sanguineo || null,
        telefone: form.telefone || null,
        nome_mae: form.nome_mae || null,
      };
      if (editando) {
        await api.put(`/pacientes/${editando.id}`, payload);
      } else {
        await api.post("/pacientes", payload);
      }
      fecharForm();
      carregar();
    } catch (err) {
      setErroForm(mensagemErro(err, "Não foi possível salvar o paciente."));
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(p: Paciente) {
    if (!window.confirm(`Excluir o cadastro de "${p.nome}"? Solicitações já registradas continuam no histórico.`)) return;
    try {
      await api.delete(`/pacientes/${p.id}`);
      carregar();
    } catch (err) {
      setErroLista(mensagemErro(err, "Não foi possível excluir o paciente."));
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os pacientes.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <Button onClick={abrirCriacao} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Paciente
        </Button>
      </div>

      {formAberto && (
        <Card>
          <h2 className="mb-4 text-lg font-medium">{editando ? "Editar Paciente" : "Novo Paciente"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Nome completo</label>
              <input required minLength={2} maxLength={200} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nº prontuário</label>
              <input inputMode="numeric" maxLength={30} value={form.numero_prontuario} onChange={(e) => setForm({ ...form, numero_prontuario: somenteDigitos(e.target.value) })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data de nascimento</label>
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sexo</label>
              <select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value as FormState["sexo"] })} className={campo}>
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="I">Ignorado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo sanguíneo</label>
              <select value={form.tipo_sanguineo} onChange={(e) => setForm({ ...form, tipo_sanguineo: e.target.value })} className={campo}>
                <option value="">Não informado</option>
                {TIPOS_SANGUINEOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CPF</label>
              <input inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: mascararCpf(e.target.value) })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cartão SUS (CNS)</label>
              <input inputMode="numeric" placeholder="000 0000 0000 0000" value={form.cns} onChange={(e) => setForm({ ...form, cns: mascararCns(e.target.value) })} className={campo} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Telefone</label>
              <input inputMode="tel" maxLength={20} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Nome da mãe</label>
              <input maxLength={200} value={form.nome_mae} onChange={(e) => setForm({ ...form, nome_mae: e.target.value })} className={campo} />
            </div>

            {erroForm && <p className="text-sm text-danger sm:col-span-3">{erroForm}</p>}

            <div className="flex items-center gap-3 sm:col-span-3">
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou nome da mãe..."
          className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-hemo focus:outline-none"
        />
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Prontuário</th>
              <th className="px-4 py-3 font-medium">Tipo Sanguíneo</th>
              <th className="px-4 py-3 font-medium">CPF</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={5}>
                  Carregando...
                </td>
              </tr>
            ) : erroLista ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={5}>
                  {erroLista}
                </td>
              </tr>
            ) : pacientes.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={5}>
                  Nenhum paciente encontrado.
                </td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">{p.nome}</td>
                  <td className="px-4 py-3">{p.numero_prontuario ?? "—"}</td>
                  <td className="px-4 py-3">{p.tipo_sanguineo ?? "—"}</td>
                  <td className="px-4 py-3">{p.cpf ? mascararCpf(p.cpf) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => abrirEdicao(p)} className="text-ink-muted hover:text-hemo" title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleExcluir(p)} className="text-ink-muted hover:text-danger" title="Excluir">
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
