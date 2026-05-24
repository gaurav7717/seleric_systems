"use client"

import { useEffect, useRef, useState } from "react"

type LogEntry = { ts: number; level: "info" | "warn" | "error"; msg: string; data?: unknown }

export function DebugLogPanel() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const sinceRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true

    async function poll() {
      while (active) {
        try {
          const res = await fetch(`/api/debug/logs?since=${sinceRef.current}`)
          const json = await res.json()
          if (json.logs?.length) {
            setLogs((prev) => [...prev, ...json.logs].slice(-300))
            sinceRef.current = json.serverTime
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    }

    poll()
    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, open])

  const levelColor = (l: string) =>
    l === "error" ? "text-red-400" : l === "warn" ? "text-yellow-400" : "text-stone-400"

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Toggle server logs"
        className="fixed bottom-20 right-4 z-50 rounded-full bg-stone-800 dark:bg-night-800 text-stone-300 dark:text-night-400 px-3 py-1 text-xs font-mono shadow hover:bg-stone-700 dark:hover:bg-night-700 transition-colors"
      >
        {open ? "hide logs" : "logs"}
      </button>

      {open && (
        <div className="fixed bottom-32 right-4 z-50 w-[520px] max-h-72 rounded-xl bg-stone-950 dark:bg-night-975 border border-stone-700 dark:border-night-800 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-800 dark:border-night-800">
            <span className="text-xs text-stone-400 font-mono">server logs (live)</span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 font-mono text-xs">
            {logs.length === 0 && (
              <p className="text-stone-600">No logs yet — send a chat message to see events.</p>
            )}
            {logs.map((e, i) => (
              <div key={i} className="flex gap-2 leading-5">
                <span className="shrink-0 text-stone-600">
                  {new Date(e.ts).toLocaleTimeString("en-IN", { hour12: false })}
                </span>
                <span className={`shrink-0 w-10 ${levelColor(e.level)}`}>{e.level}</span>
                <span className="text-stone-300 truncate">{e.msg}</span>
                {e.data != null && (
                  <span className="text-stone-500 truncate">
                    {typeof e.data === "string" ? e.data : JSON.stringify(e.data).slice(0, 80)}
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  )
}
