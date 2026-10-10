import type { ReactNode } from "react";
import clsx from "clsx";

const CORES_POR_STATUS: Record<string, string> = {
  DISPONIVEL: "bg-success/10 text-success",
  RESERVADO: "bg-warning/10 text-warning",
  TRANSFUNDIDO: "bg-neutral-200 text-neutral-600",
  DEVOLVIDO: "bg-hemo-light/20 text-hemo-dark",
  DESCARTADO: "bg-danger/10 text-danger",
  ATIVA: "bg-success/10 text-success",
  ALTA: "bg-neutral-200 text-neutral-600",
  ABERTA: "bg-danger/10 text-danger",
  INVESTIGACAO: "bg-warning/10 text-warning",
  NOTIVISA: "bg-hemo-light/20 text-hemo-dark",
  ENCERRADA: "bg-neutral-200 text-neutral-600",
  AGUARDANDO: "bg-warning/10 text-warning",
  EM_ANDAMENTO: "bg-hemo-light/20 text-hemo-dark",
  FINALIZADO: "bg-success/10 text-success",
  INTERCORRENCIA: "bg-danger/10 text-danger",
  SOLICITADA: "bg-warning/10 text-warning",
  ENVIADA: "bg-hemo-light/20 text-hemo-dark",
  RECEBIDA: "bg-success/10 text-success",
  CANCELADA: "bg-neutral-200 text-neutral-600",
};

export function Badge({ status, children }: { status?: string; children: ReactNode }) {
  const cor = status ? CORES_POR_STATUS[status] ?? "bg-neutral-200 text-neutral-600" : "bg-neutral-200 text-neutral-600";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cor)}>
      {children}
    </span>
  );
}
