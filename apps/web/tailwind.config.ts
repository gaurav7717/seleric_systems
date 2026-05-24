import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        insight: {
          canvas: "#F9F8F3",
          positive: "#2E7D32",
          negative: "#C62828",
          cost: "#B8860B",
          revenue: "#4A90D9",
          profit: "#2A9D8F",
          muted: "#6B7280",
          border: "#E5E2D8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
}

export default config
