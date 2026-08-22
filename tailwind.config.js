/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        apple: {
          canvas: "var(--apple-canvas)",
          surface: "var(--apple-surface)",
          "surface-subtle": "var(--apple-surface-subtle)",
          border: "var(--apple-border)",
          divider: "var(--apple-divider)",
          text: {
            primary: "var(--apple-text-primary)",
            secondary: "var(--apple-text-secondary)",
            tertiary: "var(--apple-text-tertiary)",
          },
          blue: {
            DEFAULT: "var(--apple-blue)",
            hover: "#0077ED",
            light: "rgba(0, 113, 227, 0.12)",
          },
        },
        status: {
          ok: "var(--status-ok)",
          warning: "var(--status-warning)",
          critical: "var(--status-critical)",
          info: "var(--status-info)",
          neutral: "var(--status-neutral)",
        },
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "Pretendard",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        "apple-card":
          "0 2px 12px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        "apple-card-dark":
          "0 4px 20px 0 rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)",
        "apple-hover":
          "0 8px 24px 0 rgba(0, 0, 0, 0.08), 0 2px 6px 0 rgba(0, 0, 0, 0.04)",
        "apple-drawer": "-8px 0 32px 0 rgba(0, 0, 0, 0.12)",
        "apple-drawer-dark": "-8px 0 32px 0 rgba(0, 0, 0, 0.5)",
      },
      borderRadius: {
        "2xl": "1rem", // 16px
        "3xl": "1.5rem", // 24px
        "4xl": "2rem", // 32px
      },
    },
  },
  plugins: [],
};
