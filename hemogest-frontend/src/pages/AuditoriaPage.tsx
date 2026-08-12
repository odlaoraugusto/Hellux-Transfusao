import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Usuario } from "@/types";

interface LinhaAuditoria {
  id: string;
  acao: string;
  entidade: string;
  usuario_id: string | null;
  created_at: string;
}

const ROTULOS_ACAO: Record<string, string> = {
  LOGIN: "Login",
  LOGIN_FALHOU: "Login falhou",
  LOGOUT: "Logout",
  CRIACAO: "Criação",
  EDICAO: "Edição",
  EXCLUSAO_LOGICA: "Exclusão",
  DOWNLOAD: "Download",
  UPLOAD: "Upload",
};

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function AuditoriaPage() {
  const { unidadeAtivaId } = useAuth();
  const [registros, setRegistros] = useState<LinhaAuditoria[]>([]);
  const [usuariosPorId, setUsuariosPorId] = useState<Record<string, string>>({});
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!unidadeAtivaId) return;
    api
      .get<Usuario[]>("/usuarios")
      .then((usuarios) => {
        const mapa: Record<string, string> = {};
        usuarios.forEach((u) => {
          mapa[u.id] = u.nome;
        });
        setUsuariosPorId(mapa);
      })
      .catch(() => setUsuariosPorId({}));
  }, [unidadeAtivaId]);

  function carregar() {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    const query = params.toString() ? `?${params.toString()}` : "";
    api
      .get<LinhaAuditoria[]>(`/relatorios/auditoria${query}`)
      .then(setRegistros)
      .catch((err) => {
        setRegistros([]);
        setErro(mensagemErro(err, "Não foi possível carregar a auditoria."));
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver a auditoria.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auditoria</h1>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Data início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Data fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
          />
        </div>
        <Button variant="secondary" onClick={carregar}>
          Filtrar
        </Button>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Data/Hora</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                  Carregando...
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={4}>
                  {erro}
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">{ROTULOS_ACAO[r.acao] ?? r.acao}</td>
                  <td className="px-4 py-3">{r.entidade}</td>
                  <td className="px-4 py-3">{r.usuario_id ? (usuariosPorId[r.usuario_id] ?? r.usuario_id) : "—"}</td>
                  <td className="px-4 py-3">{formatarDataHora(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
