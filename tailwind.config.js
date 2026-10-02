/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        apple: {
          canvas: "#F5F5F7",
          surface: "#FFFFFF",
          subtle: "#EBEBED",
          border: "rgba(0, 0, 0, 0.06)",
          divider: "rgba(0, 0, 0, 0.04)",
          text: {
            primary: "#1D1D1F",
            secondary: "#86868B",
            tertiary: "#A1A1A6",
          },
          blue: {
            DEFAULT: "#0071E3",
            hover: "#0077ED",
            light: "#E8F2FD",
          },
          green: {
            DEFAULT: "#34C759",
            light: "#EAF8EE",
            dark: "#248A3D",
          },
          red: {
            DEFAULT: "#FF3B30",
            light: "#FEECEB",
            dark: "#D70015",
          },
          orange: {
            DEFAULT: "#FF9500",
            light: "#FFF4E5",
            dark: "#C93400",
          },
          gold: {
            DEFAULT: "#D97706",
            light: "#FEF3C7",
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
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Nanum Gothic",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        serif: [
          "Newsreader",
          "Noto Serif KR",
          "Georgia",
          "Nanum Myeongjo",
          "serif",
        ],
      },
      boxShadow: {
        "apple-card":
          "0 2px 12px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        "apple-card-dark":
          "0 4px 20px 0 rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)",
        "apple-hover":
          "0 8px 24px 0 rgba(0, 0, 0, 0.08), 0 2px 6px 0 rgba(0, 0, 0, 0.04)",
        "apple-pill": "0 1px 3px 0 rgba(0, 0, 0, 0.08)",
        "apple-modal": "0 20px 48px -12px rgba(0, 0, 0, 0.16)",
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
