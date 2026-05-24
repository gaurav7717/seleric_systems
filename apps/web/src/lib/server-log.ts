/**
 * In-process log ring-buffer — lets /api/debug/logs surface recent server events
 * without needing a separate log aggregator.
 */
import "server-only"

export type LogEntry = {
  ts: number
  level: "info" | "warn" | "error"
  msg: string
  data?: unknown
}

const MAX = 200
const _buf: LogEntry[] = []

export function serializeError(e: unknown): string {
  if (e == null) return "null"
  if (typeof e === "string") return e
  if (e instanceof Error) {
    const extra = Object.keys(e).length ? ` ${JSON.stringify(e)}` : ""
    return `${e.name}: ${e.message}${extra}`
  }
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

export function serverLog(level: LogEntry["level"], msg: string, data?: unknown) {
  if (_buf.length >= MAX) _buf.shift()
  const safe = data instanceof Error ? serializeError(data) : data
  _buf.push({ ts: Date.now(), level, msg, data: safe })
  const line = safe != null ? `[${level.toUpperCase()}] ${msg} ${JSON.stringify(safe).slice(0, 300)}` : `[${level.toUpperCase()}] ${msg}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export function getRecentLogs(since = 0): LogEntry[] {
  return _buf.filter((e) => e.ts > since)
}
