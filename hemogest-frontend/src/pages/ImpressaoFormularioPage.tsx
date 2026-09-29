import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormularioImpressao } from "@/components/FormularioImpressao";
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
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);

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

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado("sim");
    } catch {
      setCopiado("falhou");
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
        {modo === "publico" && (
          <Button variant="secondary" onClick={copiarLink} className="flex items-center gap-2 bg-white">
            <Copy size={16} />
            {copiado === "sim" ? "Link copiado" : "Copiar link para imprimir depois"}
          </Button>
        )}
        <Button onClick={() => window.print()} disabled={!dados} className="flex items-center gap-2">
          <Printer size={16} />
          Imprimir
        </Button>
      </div>

      {modo === "publico" && (
        <p className="mx-auto mb-3 max-w-[210mm] text-sm text-neutral-700 print:hidden" role="status">
          {copiado === "falhou"
            ? "Não foi possível copiar. Guarde o endereço desta página para imprimir de novo."
            : "Formulário gravado. Quem tiver o endereço desta página consegue reabri-lo para imprimir, por isso guarde o link."}{" "}
          Para salvar em PDF, escolha “Salvar como PDF” na janela de impressão.
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
