import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Campo de senha com o "olho" pra mostrar/esconder o texto digitado
 * (2026-10-01, pedido do cliente). Mesmo visual dos campos de senha do
 * projeto, só com o botão e o espaço a mais pra ele não sobrepor o texto. */
export function CampoSenha(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visivel ? "text" : "password"}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 text-sm focus:border-hemo focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        tabIndex={-1}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink"
      >
        {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
