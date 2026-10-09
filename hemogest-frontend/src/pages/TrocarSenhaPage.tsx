import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CampoSenha } from "@/components/ui/CampoSenha";

function mensagemErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detalhe = (err.body as { detail?: unknown }).detail;
    if (typeof detalhe === "string") return detalhe;
  }
  return padrao;
}

export function TrocarSenhaPage() {
  const { usuario, refrescarUsuario } = useAuth();
  const navigate = useNavigate();
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
      await refrescarUsuario();
      if (usuario?.primeiro_acesso) navigate("/", { replace: true });
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
            <CampoSenha required autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nova Senha</label>
            <CampoSenha required minLength={8} autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirmar Nova Senha</label>
            <CampoSenha required minLength={8} autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
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
