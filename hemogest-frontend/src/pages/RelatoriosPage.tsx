import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type LinhaRelatorio = Record<string, unknown>;

interface TipoRelatorio {
  chave: string;
  rotulo: string;
  temFiltroData: boolean;
}

const TIPOS_RELATORIO: TipoRelatorio[] = [
  { chave: "pacientes", rotulo: "Pacientes", temFiltroData: false },
  { chave: "internacoes", rotulo: "Internações", temFiltroData: true },
  { chave: "hemocomponentes", rotulo: "Hemocomponentes", temFiltroData: false },
  { chave: "transfusoes", rotulo: "Transfusões", temFiltroData: true },
  { chave: "reacoes", rotulo: "Reações", temFiltroData: true },
  { chave: "devolucoes", rotulo: "Devoluções", temFiltroData: true },
  { chave: "descartes", rotulo: "Descartes", temFiltroData: true },
];

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return String(valor);
}

function paraCsv(linhas: LinhaRelatorio[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const escapar = (valor: unknown) => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };
  const cabecalho = colunas.join(",");
  const linhasCsv = linhas.map((linha) => colunas.map((coluna) => escapar(linha[coluna])).join(","));
  return [cabecalho, ...linhasCsv].join("\n");
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RelatoriosPage() {
  const { unidadeAtivaId } = useAuth();
  const [tipo, setTipo] = useState<TipoRelatorio>(TIPOS_RELATORIO[0]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    if (!unidadeAtivaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (tipo.temFiltroData) {
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    api
      .get<LinhaRelatorio[]>(`/relatorios/${tipo.chave}${query}`)
      .then(setLinhas)
      .catch((err) => {
        setLinhas([]);
        setErro(mensagemErro(err, "Não foi possível carregar o relatório."));
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, unidadeAtivaId]);

  function exportarCsv() {
    const csv = paraCsv(linhas);
    if (!csv) return;
    baixarCsv(csv, `relatorio-${tipo.chave}.csv`);
  }

  const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : [];

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os relatórios.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <Button onClick={exportarCsv} disabled={linhas.length === 0} className="flex items-center gap-2">
          <Download size={16} />
          Exportar CSV
        </Button>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TIPOS_RELATORIO.map((t) => (
            <button
              key={t.chave}
              onClick={() => setTipo(t)}
              className={
                t.chave === tipo.chave
                  ? "rounded-lg bg-hemo px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-neutral-100"
              }
            >
              {t.rotulo}
            </button>
          ))}
        </div>

        {tipo.temFiltroData && (
          <div className="flex flex-wrap items-end gap-4">
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
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-ink-muted">
            <tr>
              {colunas.length === 0 ? (
                <th className="px-4 py-3 font-medium">Dados</th>
              ) : (
                colunas.map((coluna) => (
                  <th key={coluna} className="whitespace-nowrap px-4 py-3 font-medium">
                    {coluna}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={Math.max(colunas.length, 1)}>
                  Carregando...
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td className="px-4 py-6 text-center text-danger" colSpan={Math.max(colunas.length, 1)}>
                  {erro}
                </td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-ink-muted" colSpan={Math.max(colunas.length, 1)}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              linhas.map((linha, indice) => (
                <tr key={indice} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  {colunas.map((coluna) => (
                    <td key={coluna} className="whitespace-nowrap px-4 py-3">
                      {formatarValor(linha[coluna])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
