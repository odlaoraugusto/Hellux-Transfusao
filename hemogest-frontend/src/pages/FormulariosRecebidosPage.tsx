import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Copy, Printer, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MODALIDADES, MODALIDADE_ROTULO, formatarHora } from "@/lib/formulario";
import { deslocarDia, hojeLocal, intervaloDoDia } from "@/lib/datas";
import type { FormularioResumo } from "@/types";

const campo =
  "rounded-lg border border-neutral-300 bg-surface-card px-3 py-2 text-sm focus:border-hemo focus:outline-none";

const COR_MODALIDADE: Record<string, string> = {
  EMERGENCIA: "bg-danger/10 text-danger",
  URGENCIA: "bg-warning/15 text-amber-800 dark:text-amber-300",
  ROTINA: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  PROGRAMADA: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};

export function FormulariosRecebidosPage() {
  const { unidadeAtivaId } = useAuth();
  const [dia, setDia] = useState(hojeLocal);
  const [modalidade, setModalidade] = useState("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<FormularioResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);

  const ehHoje = dia === hojeLocal();
  const linkPublico = unidadeAtivaId ? `${window.location.origin}/solicitar/${unidadeAtivaId}` : "";

  function carregar(silencioso = false) {
    if (!unidadeAtivaId) return;
    if (!silencioso) setCarregando(true);
    const { de, ate } = intervaloDoDia(dia);
    const filtro = modalidade ? `&modalidade=${modalidade}` : "";
    api
      .get<FormularioResumo[]>(`/formularios-solicitacao?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}${filtro}`)
      .then((itens) => {
        setLista(itens);
        setErro(null);
      })
      .catch((err) => {
        if (!silencioso) setErro(err instanceof ApiError ? "Não foi possível carregar os formulários." : "Sem conexão com o servidor.");
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    if (!ehHoje) return;
    const timer = window.setInterval(() => carregar(true), 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtivaId, dia, modalidade]);

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? lista.filter((f) => f.nome_paciente.toLowerCase().includes(termo) || f.protocolo.toLowerCase().includes(termo)) : lista;
  }, [lista, busca]);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkPublico);
      setCopiado("sim");
    } catch {
      setCopiado("falhou");
    }
  }

  if (!unidadeAtivaId) {
    return <p className="text-ink-muted">Selecione uma unidade hospitalar para ver os formulários recebidos.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Formulários recebidos</h1>
        <p className="text-sm text-ink-muted">Solicitações de transfusão enviadas pelo formulário público, prontas para imprimir.</p>
      </div>

      <Card className="space-y-2">
        <h2 className="text-sm font-medium">Link do formulário público</h2>
        <p className="text-sm text-ink-muted">Qualquer pessoa com este endereço preenche o formulário, sem login. Envie só para os setores do seu hospital.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={linkPublico} onFocus={(e) => e.currentTarget.select()} aria-label="Link do formulário público" className={clsx(campo, "min-w-0 flex-1 font-mono text-xs")} />
          <Button variant="secondary" onClick={copiarLink} className="flex items-center gap-2">
            <Copy size={16} />
            {copiado === "sim" ? "Link copiado" : "Copiar link"}
          </Button>
          <a href={linkPublico} target="_blank" rel="noreferrer" className="rounded-lg px-4 py-2 text-sm font-medium text-hemo hover:bg-hemo/5">
            Abrir
          </a>
        </div>
        {copiado === "falhou" && <p className="text-xs text-danger">Não foi possível copiar. Selecione o endereço e copie manualmente.</p>}
      </Card>

      <Card className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Dia de recebimento</label>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setDia(deslocarDia(dia, -1))} className="rounded-lg border border-neutral-300 p-2" aria-label="Dia anterior">
              <ChevronLeft size={16} />
            </button>
            <input type="date" value={dia} max={hojeLocal()} onChange={(e) => e.target.value && setDia(e.target.value)} className={clsx(campo, "w-40")} />
            <button type="button" onClick={() => setDia(deslocarDia(dia, 1))} disabled={ehHoje} className="rounded-lg border border-neutral-300 p-2 disabled:opacity-40" aria-label="Próximo dia">
              <ChevronRight size={16} />
            </button>
            {!ehHoje && (
              <Button variant="ghost" onClick={() => setDia(hojeLocal())}>
                Hoje
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Modalidade</label>
          <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {MODALIDADES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Paciente ou protocolo" className={clsx(campo, "w-full")} />
        </div>
        <Button variant="secondary" onClick={() => carregar()} className="flex items-center gap-2">
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </Card>

      {carregando && <p className="text-ink-muted">Carregando formulários...</p>}
      {erro && <p className="text-danger">{erro}</p>}

      {!carregando && !erro && (
        <Card className="overflow-x-auto p-0">
          {filtrada.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              {lista.length === 0 ? "Nenhum formulário recebido neste dia." : "Nenhum formulário corresponde à busca."}
            </p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr className="border-b border-neutral-200">
                  <th className="px-4 py-2 font-medium">Recebido</th>
                  <th className="px-4 py-2 font-medium">Protocolo</th>
                  <th className="px-4 py-2 font-medium">Paciente</th>
                  <th className="px-4 py-2 font-medium">Setor / leito</th>
                  <th className="px-4 py-2 font-medium">Modalidade</th>
                  <th className="px-4 py-2 font-medium">Hemocomponentes</th>
                  <th className="px-4 py-2 font-medium">Médico</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtrada.map((f) => (
                  <tr key={f.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{new Date(f.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{f.protocolo}</td>
                    <td className="px-4 py-2.5 font-medium">{f.nome_paciente}</td>
                    <td className="px-4 py-2.5">
                      {f.setor_nome} · {f.leito}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", COR_MODALIDADE[f.modalidade])}>{MODALIDADE_ROTULO[f.modalidade]}</span>
                    </td>
                    <td className="px-4 py-2.5">{f.hemocomponentes.join(", ")}</td>
                    <td className="px-4 py-2.5">{f.medico_nome}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to={`/formularios/${f.id}/imprimir`} className="inline-flex items-center gap-1.5 rounded-lg border border-hemo px-3 py-1.5 text-xs font-medium text-hemo hover:bg-hemo/5" title={`Preenchido às ${formatarHora(f.hora_solicitacao)}`}>
                        <Printer size={14} /> Imprimir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
