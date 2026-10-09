import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormularioImpressao } from "@/components/FormularioImpressao";
import { abrirBlobPdf, gerarPdfSolicitacao } from "@/lib/gerarPdfSolicitacao";
import type { FormularioSolicitacao } from "@/types";

/**
 * Visualização para impressão de um formulário já gravado.
 * - modo "publico": aberta pelo link com token (sem login), que quem enviou
 *   o formulário recebe ao gravar;
 * - modo "interno": aberta pela lista de formulários recebidos (com login).
 */
export function ImpressaoFormularioPage({ modo }: { modo: "publico" | "interno" }) {
  const { token, id } = useParams();
  const location = useLocation();
  const unidadeIdPublica = (location.state as { unidadeId?: string } | null)?.unidadeId;

  const [dados, setDados] = useState<FormularioSolicitacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  useEffect(() => {
    const caminho = modo === "publico" ? `/publico/formularios/${token}` : `/formularios-solicitacao/${id}`;
    api
      .get<FormularioSolicitacao>(caminho)
      .then((d) => {
        setDados(d);
        document.title = `Solicitação ${d.protocolo}`;
      })
      .catch((err) =>
        setErro(
          err instanceof ApiError && err.status === 404
            ? "Formulário não encontrado. Confira se o link está completo."
            : "Não foi possível abrir o formulário. Tente novamente.",
        ),
      );
  }, [modo, token, id]);

  async function imprimirPdfOficial() {
    if (!dados) return;
    setErroPdf(null);
    setGerandoPdf(true);
    try {
      const bytes = await gerarPdfSolicitacao(dados);
      const url = abrirBlobPdf(bytes);
      // Manda direto pra caixa de diálogo de impressão do navegador (que já
      // escolhe a impressora), em vez de baixar um arquivo (2026-09-30,
      // pedido do cliente) — iframe oculto carrega o PDF e dispara o print.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
      document.body.appendChild(iframe);
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 120_000);
    } catch {
      setErroPdf("Não foi possível gerar o PDF oficial. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-200 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 print:hidden">
        {modo === "interno" ? (
          <Link to="/formularios" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-white/60">
            <ArrowLeft size={16} /> Formulários recebidos
          </Link>
        ) : (
          unidadeIdPublica && (
            <Link to={`/solicitar/${unidadeIdPublica}`} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-white/60">
              <ArrowLeft size={16} /> Novo formulário
            </Link>
          )
        )}
        <div className="flex-1" />
        <Button onClick={imprimirPdfOficial} disabled={!dados || gerandoPdf} className="flex items-center gap-2">
          <Printer size={16} />
          {gerandoPdf ? "Gerando PDF..." : "Imprimir PDF oficial (STH)"}
        </Button>
      </div>

      {erroPdf && <p className="mx-auto mb-3 max-w-[210mm] rounded-lg bg-danger/10 p-3 text-sm text-danger print:hidden">{erroPdf}</p>}

      {modo === "publico" && (
        <p className="mx-auto mb-3 max-w-[210mm] text-sm text-neutral-700 print:hidden" role="status">
          Use “Imprimir PDF oficial” para gerar o documento (STH) já preenchido e mandar direto para a impressora.
        </p>
      )}

      {erro && <p className="mx-auto max-w-[210mm] rounded-lg bg-white p-4 text-danger">{erro}</p>}
      {!erro && !dados && <p className="mx-auto max-w-[210mm] text-neutral-600">Carregando formulário...</p>}
      {dados && (
        <div className="mx-auto max-w-[210mm] bg-white shadow-lg print:shadow-none">
          <FormularioImpressao dados={dados} />
        </div>
      )}
    </div>
  );
}
