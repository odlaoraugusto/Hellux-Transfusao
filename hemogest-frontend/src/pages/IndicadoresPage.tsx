import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";

interface Indicadores {
  periodo_dias: number;
  assistenciais: {
    total_transfusoes_finalizadas: number;
  };
  operacionais: {
    total_bolsas_cadastradas: number;
    total_descartes: number;
    total_devolucoes: number;
    taxa_descarte: number;
    taxa_devolucao: number;
  };
  qualidade: {
    total_reacoes: number;
    taxa_reacao_por_transfusao: number;
  };
}

const OPCOES_PERIODO = [7, 30, 90, 365];

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarPercentual(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`;
}

function CardMetrica({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <Card>
      <p className="text-sm text-ink-muted">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
    </Card>
  );
}

export function IndicadoresPage() {
  const { unidadeAtivaId } = useAuth();
  const [dias, setDias] = useState(30);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    api
      .get<Indicadores>(`/indicadores?dias=${dias}`)
      .then(setIndicadores)
      .catch((err) => {
        setIndicadores(null);
        setErro(mensagemErro(err, "Não foi possível carregar os indicadores."));
      })
      .finally(() => setCarregando(false));
  }, [dias, unidadeAtivaId]);

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os indicadores.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Indicadores</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-ink-muted">Período</label>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
          >
            {OPCOES_PERIODO.map((opcao) => (
              <option key={opcao} value={opcao}>
                Últimos {opcao} dias
              </option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <p className="text-ink-muted">Carregando...</p>
      ) : erro ? (
        <p className="text-danger">{erro}</p>
      ) : indicadores ? (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-medium">Assistenciais</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardMetrica
                rotulo="Transfusões finalizadas"
                valor={indicadores.assistenciais.total_transfusoes_finalizadas}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Operacionais</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardMetrica rotulo="Bolsas cadastradas" valor={indicadores.operacionais.total_bolsas_cadastradas} />
              <CardMetrica rotulo="Descartes" valor={indicadores.operacionais.total_descartes} />
              <CardMetrica rotulo="Devoluções" valor={indicadores.operacionais.total_devolucoes} />
              <CardMetrica rotulo="Taxa de descarte" valor={formatarPercentual(indicadores.operacionais.taxa_descarte)} />
              <CardMetrica
                rotulo="Taxa de devolução"
                valor={formatarPercentual(indicadores.operacionais.taxa_devolucao)}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Qualidade</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardMetrica rotulo="Reações transfusionais" valor={indicadores.qualidade.total_reacoes} />
              <CardMetrica
                rotulo="Taxa de reação por transfusão"
                valor={formatarPercentual(indicadores.qualidade.taxa_reacao_por_transfusao)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
