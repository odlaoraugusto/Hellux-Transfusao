import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ACOES_CONFIGURAVEIS, PERFIS_CONFIGURAVEIS, podeGerenciarPermissoes } from "@/lib/permissoes";
import type { Role } from "@/types";

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

/** Tela exclusiva de Admin Global e Supervisor (2026-09-30, pedido do
 * cliente) — decide o que Biomédico e Técnico podem fazer além da própria
 * conta. Admin Global e Supervisor sempre têm tudo liberado e não
 * aparecem na matriz (mesmo padrão do projeto irmão Almoxarifado). */
export function PermissoesPage() {
  const { usuario } = useAuth();

  if (!podeGerenciarPermissoes(usuario?.role_codigo)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Permissões</h1>
        <Card className="text-center text-sm text-ink-muted">Gerenciar permissões é exclusivo de Admin Global e Supervisor.</Card>
      </div>
    );
  }

  return <GestaoPermissoes />;
}

function GestaoPermissoes() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<Record<"BIOMEDICO" | "TECNICO", string[]>>({ BIOMEDICO: [], TECNICO: [] });
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState<"BIOMEDICO" | "TECNICO" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    setErro(null);
    api
      .get<Role[]>("/roles")
      .then((lista) => {
        setRoles(lista);
        setForm({
          BIOMEDICO: lista.find((r) => r.codigo === "BIOMEDICO")?.permissoes ?? [],
          TECNICO: lista.find((r) => r.codigo === "TECNICO")?.permissoes ?? [],
        });
      })
      .catch((err) => setErro(mensagemErro(err, "Não foi possível carregar as permissões.")))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  function alternar(perfil: "BIOMEDICO" | "TECNICO", chave: string) {
    setSucesso(null);
    setForm((atual) => ({
      ...atual,
      [perfil]: atual[perfil].includes(chave) ? atual[perfil].filter((c) => c !== chave) : [...atual[perfil], chave],
    }));
  }

  async function salvar(perfil: "BIOMEDICO" | "TECNICO") {
    const role = roles.find((r) => r.codigo === perfil);
    if (!role) return;
    setErro(null);
    setSucesso(null);
    setSalvandoPerfil(perfil);
    try {
      await api.patch(`/roles/${role.id}/permissoes`, { permissoes: form[perfil] });
      setSucesso(`Permissões de ${perfil === "BIOMEDICO" ? "Biomédico" : "Técnico"} atualizadas.`);
      carregar();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível salvar as permissões."));
    } finally {
      setSalvandoPerfil(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Permissões</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Define o que Biomédico e Técnico podem fazer. Admin Global e Supervisor sempre têm tudo liberado e não aparecem nesta matriz.
        </p>
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      {sucesso && <p className="text-sm text-success">{sucesso}</p>}

      <Card className="p-0">
        {carregando ? (
          <p className="p-6 text-center text-sm text-ink-muted">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  {PERFIS_CONFIGURAVEIS.map((p) => (
                    <th key={p.codigo} className="px-4 py-3 text-center font-medium">
                      {p.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACOES_CONFIGURAVEIS.map((acao) => (
                  <tr key={acao.chave} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{acao.rotulo}</div>
                      <div className="text-xs text-ink-muted">{acao.ajuda}</div>
                    </td>
                    {PERFIS_CONFIGURAVEIS.map((p) => (
                      <td key={p.codigo} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={form[p.codigo].includes(acao.chave)}
                          onChange={() => alternar(p.codigo, acao.chave)}
                          className="h-4 w-4 accent-hemo"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3">
              {PERFIS_CONFIGURAVEIS.map((p) => (
                <Button key={p.codigo} onClick={() => salvar(p.codigo)} disabled={salvandoPerfil !== null}>
                  {salvandoPerfil === p.codigo ? "Salvando..." : `Salvar ${p.rotulo}`}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
