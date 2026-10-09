import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "light" | "dark";

const CHAVE_TEMA = "hemogest.tema";

function lerTemaSalvo(): Tema | null {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    return salvo === "dark" || salvo === "light" ? salvo : null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext<{ tema: Tema; alternar: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // A escolha manual do usuário (localStorage) tem prioridade sobre a
  // preferência do sistema — sem isso, um F5 perdia o modo escuro escolhido
  // e voltava pro que o SO/navegador preferisse (2026-09-30, pedido do
  // cliente: "dark mode não persiste no F5").
  const [tema, setTema] = useState<Tema>(
    () => lerTemaSalvo() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
  }, [tema]);

  function alternar() {
    setTema((t) => {
      const novo = t === "light" ? "dark" : "light";
      try {
        localStorage.setItem(CHAVE_TEMA, novo);
      } catch {
        /* sem storage: só dura a sessão atual */
      }
      return novo;
    });
  }

  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
