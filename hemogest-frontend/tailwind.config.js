/** HemoGest — tokens de design congelados em docs/05-Architecture.md.
 * Não redefinir cores fora deste arquivo. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        hemo: {
          DEFAULT: "#C62828", // Vermelho Hemo — primária
          dark: "#8E1B1B", // Vermelho Escuro — hover/ativo
          light: "#E57373", // Vermelho Claro — alertas leves
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
