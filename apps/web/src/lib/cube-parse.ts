/**
 * Parse MCP tool text blocks — handles pure JSON and preamble + JSON (cube_pnl_today_yesterday).
 */
export function parseMcpText(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const jsonStart = trimmed.search(/\n\s*\{/)
    if (jsonStart >= 0) {
      try {
        return JSON.parse(trimmed.slice(jsonStart).trim())
      } catch {
        /* fall through */
      }
    }
    return trimmed
  }
}
