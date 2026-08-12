import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Droplet, AlertTriangle, Activity, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import type { EstoqueItem, IndicadorDiario, Pendencias } from "@/types";

interface Alertas {
  bolsas_proximas_vencimento: number;
  tipos_com_estoque_critico: number;
  reacoes_notificadas_notivisa: number;
}

export function DashboardPage() {
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [alertas, setAlertas] = useState<Alertas | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadorDiario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const { unidadeAtivaId } = useAuth();

  useEffect(() => {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(false);
    Promise.all([
      api.get<EstoqueItem[]>("/dashboard/estoque"),
      api.get<Pendencias>("/dashboard/pendencias"),
      api.get<Alertas>("/dashboard/alertas"),
      api.get<IndicadorDiario[]>("/dashboard/indicadores-diarios?dias=7"),
    ])
      .then(([e, p, a, i]) => {
        setEstoque(e);
        setPendencias(p);
        setAlertas(a);
        setIndicadores(i);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [unidadeAtivaId]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver o dashboard.</p>;
  }
  if (carregando) return <p className="text-ink-muted">Carregando dashboard...</p>;
  if (erro) return <p className="text-danger">Não foi possível carregar o dashboard. Tente novamente.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Estoque de Hemocomponentes</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {estoque.map((item) => (
            <Card key={item.hemocomponente_id} className="flex items-center gap-3">
              <div className="rounded-full bg-hemo/10 p-2 text-hemo">
                <Droplet size={20} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{item.bolsas_disponiveis}</p>
                <p className="text-xs text-ink-muted">{item.sigla ?? item.nome}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="flex items-center gap-3">
          <Activity className="text-warning" size={20} />
          <div>
            <p className="text-xl font-semibold">{pendencias?.transfusoes_em_andamento ?? 0}</p>
            <p className="text-xs text-ink-muted">Transfusões em andamento</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <AlertTriangle className="text-danger" size={20} />
          <div>
            <p className="text-xl font-semibold">{pendencias?.reacoes_abertas ?? 0}</p>
            <p className="text-xs text-ink-muted">Reações abertas</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <ClipboardList className="text-warning" size={20} />
          <div>
            <p className="text-xl font-semibold">{alertas?.bolsas_proximas_vencimento ?? 0}</p>
            <p className="text-xs text-ink-muted">Bolsas próximas do vencimento</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Droplet className="text-danger" size={20} />
          <div>
            <p className="text-xl font-semibold">{alertas?.tipos_com_estoque_critico ?? 0}</p>
            <p className="text-xs text-ink-muted">Tipos com estoque crítico</p>
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <h2 className="mb-4 text-sm font-medium text-ink-muted">Indicadores Diários (últimos 7 dias)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={indicadores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="entradas" stroke="#2E7D32" name="Entradas" />
              <Line type="monotone" dataKey="saidas" stroke="#C62828" name="Saídas" />
              <Line type="monotone" dataKey="descartes" stroke="#F9A825" name="Descartes" />
              <Line type="monotone" dataKey="retornos" stroke="#8E1B1B" name="Retornos" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>
    </div>
  );
}
