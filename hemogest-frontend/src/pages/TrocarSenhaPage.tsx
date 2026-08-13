import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

export function TrocarSenhaPage() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    if (novaSenha.length < 8) {
      setErro("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro("A confirmação não bate com a nova senha.");
      return;
    }

    setSalvando(true);
    try {
      await api.post("/auth/change-password", { senha_atual: senhaAtual, nova_senha: novaSenha });
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErro("Senha atual incorreta.");
      } else {
        setErro(mensagemErro(err, "Não foi possível trocar a senha."));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trocar Senha</h1>

      <Card className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Senha Atual</label>
            <input
              type="password"
              required
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nova Senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
            />
          </div>

          {erro && <p className="text-sm text-danger">{erro}</p>}
          {sucesso && <p className="text-sm text-success">Senha alterada com sucesso.</p>}

          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar Nova Senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
