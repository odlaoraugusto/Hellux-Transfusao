/** HemoGest — tokens de design congelados em docs/05-Architecture.md.
 * Não redefinir cores fora deste arquivo. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 2026-10-01, pedido do cliente: layout "meio aqua" no sistema
        // inteiro — cor primária trocada do vermelho institucional pro
        // verde-água (mesmo tom já usado no formulário público, ver
        // `formpub` abaixo). docs/05-Architecture.md atualizado junto.
        hemo: {
          DEFAULT: "#3E6E68", // Verde-água — primária
          dark: "#2A4E49", // Verde-água escuro — hover/ativo
          light: "#6FA69D", // Verde-água claro — alertas leves
        },
        surface: {
          bg: "#F7F8FA",
          card: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#212121",
          muted: "#616161", // Cinza Texto
        },
        success: "#2E7D32",
        warning: "#F9A825",
        danger: "#D32F2F",
        // Paleta usada só no formulário público de solicitação (2026-09-30,
        // pedido do cliente: o vermelho institucional "doía o olho" em quem
        // fica preenchendo o formulário por muito tempo). Verde-água sóbrio,
        // não é cor da identidade oficial — não usar fora do formulário público.
        formpub: {
          DEFAULT: "#3E6E68",
          dark: "#2A4E49",
        },
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
