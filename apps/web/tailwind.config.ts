import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // warm espresso-charcoal dark palette — matte, editorial, zero blue tint
        night: {
          50:  "#EDE8E0",  // primary text (warm off-white)
          100: "#DDD8CE",  // heading text
          200: "#C4BEB5",  // body text
          300: "#A8A298",  // secondary text
          400: "#8B857C",  // muted text
          500: "#6F6A61",  // placeholder / label
          600: "#534E46",  // extra muted
          700: "#3D3A30",  // ring / strong border
          800: "#2E2C23",  // border
          850: "#26231C",  // active nav / hover
          875: "#201E18",  // card bg (slightly warmer)
          900: "#1A1815",  // card surface
          925: "#141210",  // sidebar / header
          950: "#0F0D0A",  // page base (darkest)
        },
        insight: {
          canvas: "#F9F8F3",
          // semantic colors are CSS-variable-driven so dark mode adapts automatically
          positive: "var(--color-insight-positive)",
          negative: "var(--color-insight-negative)",
          cost:     "var(--color-insight-cost)",
          revenue:  "var(--color-insight-revenue)",
          profit:   "var(--color-insight-profit)",
          muted:    "var(--color-insight-muted)",
          border:   "#E5E2D8",
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
