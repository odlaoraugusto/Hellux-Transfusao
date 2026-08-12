import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import type { Paciente } from "@/types";

export function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [termo, setTermo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const { unidadeAtivaId } = useAuth();

  useEffect(() => {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    const timeout = setTimeout(() => {
      setCarregando(true);
      const query = termo ? `?termo=${encodeURIComponent(termo)}` : "";
      api
        .get<Paciente[]>(`/pacientes${query}`)
        .then(setPacientes)
        .catch(() => setPacientes([]))
        .finally(() => setCarregando(false));
    }, 300); // debounce simples de pesquisa

    return () => clearTimeout(timeout);
  }, [termo, unidadeAtivaId]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os pacientes.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                  Carregando...
                </td>
              </tr>
            ) : pacientes.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                  Nenhum paciente encontrado.
                </td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">{p.nome}</td>
                  <td className="px-4 py-3">{p.numero_prontuario ?? "—"}</td>
                  <td className="px-4 py-3">{p.tipo_sanguineo ?? "—"}</td>
                  <td className="px-4 py-3">{p.cpf ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
