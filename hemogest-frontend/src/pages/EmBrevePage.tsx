import { Card } from "@/components/ui/Card";

export function EmBrevePage({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <Card>
        <p className="text-ink-muted">
          Tela ainda não implementada neste scaffold inicial. O endpoint correspondente já existe no
          backend — falta só a interface aqui.
        </p>
      </Card>
    </div>
  );
}
