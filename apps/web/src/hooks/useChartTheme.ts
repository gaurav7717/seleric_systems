"use client"

import { useEffect, useState } from "react"

export interface ChartTheme {
  grid: string
  tick: string
  tooltip: React.CSSProperties
  legend: React.CSSProperties
  polar: string  // polar grid stroke for radar charts
}

const LIGHT: ChartTheme = {
  grid:  "#E5E2D8",   // warm parchment — matches insight-border
  tick:  "#78716C",   // stone-500 warm
  polar: "#E5E2D8",
  tooltip: {
    background: "#FFFFFF",
    border: "1px solid #E5E2D8",
    borderRadius: 8,
    fontSize: 12,
    color: "#1C1917",
  },
  legend: { fontSize: 11, color: "#78716C" },
}

const DARK: ChartTheme = {
  grid:  "#2E2C23",   // night-800 warm border
  tick:  "#A8A298",   // night-300 — readable on night-900/950
  polar: "#2E2C23",
  tooltip: {
    background: "#1A1815",  // night-900
    border: "1px solid #2E2C23",
    borderRadius: 8,
    fontSize: 12,
    color: "#EDE8E0",       // night-50
  },
  legend: { fontSize: 11, color: "#A8A298" },
}

function isDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark")
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => (isDark() ? DARK : LIGHT))

  useEffect(() => {
    setTheme(isDark() ? DARK : LIGHT)
    const obs = new MutationObserver(() => setTheme(isDark() ? DARK : LIGHT))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  return theme
}
