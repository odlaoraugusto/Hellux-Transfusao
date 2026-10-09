import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { rotaInicial } from "@/lib/permissoes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CampoSenha } from "@/components/ui/CampoSenha";

export function LoginPage() {
  const { usuario, carregando: carregandoSessao, login } = useAuth();
  const navigate = useNavigate();
  const [usuarioLogin, setUsuarioLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Já logado (ex.: voltou pra /login sem querer, com a sessão ainda
  // válida) — manda direto pra tela inicial em vez de pedir login de novo
  // (2026-10-02, pedido do cliente: "sem deslogar se eu clicar na tela de
  // login já estando logado"). Só decide depois que a sessão guardada
  // termina de ser conferida (carregandoSessao), senão pisca a tela de
  // login antes de descobrir que já tem sessão.
  if (carregandoSessao) return null;
  if (usuario) return <Navigate to={rotaInicial(usuario.role_codigo)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const eu = await login(usuarioLogin, senha);
      navigate(rotaInicial(eu.role_codigo), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErro("Login ou senha inválidos.");
      } else {
        setErro("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-bg px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-1">
          <img src="/brand/hemogest-logo-horizontal.svg" alt="Hellux — Módulo de Transfusão" className="h-24" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Login</label>
            <input
              type="text"
              autoComplete="username"
              required
              value={usuarioLogin}
              onChange={(e) => setUsuarioLogin(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-hemo focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Senha</label>
            <CampoSenha required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>

          {erro && <p className="text-sm text-danger">{erro}</p>}

          <Button type="submit" disabled={carregando} className="w-full">
            {carregando ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
