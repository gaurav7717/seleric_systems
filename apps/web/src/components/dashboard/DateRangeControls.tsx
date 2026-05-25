"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"

interface Props {
  start: string
  end: string
  spanDays: number
  searchParams?: Record<string, string | string[] | undefined>
}

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "365d", days: 365 },
] as const

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

function addDaysIso(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function normalizeRange(start: string, end: string): { start: string; end: string } {
  return start <= end ? { start, end } : { start: end, end: start }
}

function buildSearchParams(searchParams: Props["searchParams"]): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item))
    } else if (value !== undefined) {
      params.set(key, value)
    }
  }
  return params
}

export function DateRangeControls({ start, end, spanDays, searchParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [draftStart, setDraftStart] = useState(start)
  const [draftEnd, setDraftEnd] = useState(end)

  useEffect(() => {
    setDraftStart(start)
    setDraftEnd(end)
  }, [start, end])

  function pushRange(nextStart: string, nextEnd: string) {
    const normalized = normalizeRange(nextStart, nextEnd)
    const params = buildSearchParams(searchParams)
    params.set("start", normalized.start)
    params.set("end", normalized.end)

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function applyPreset(days: number) {
    const nextEnd = todayIST()
    const nextStart = addDaysIso(nextEnd, -(days - 1))
    setDraftStart(nextStart)
    setDraftEnd(nextEnd)
    pushRange(nextStart, nextEnd)
  }

  const canApply = Boolean(draftStart && draftEnd)

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 p-3 shadow-sm dark:shadow-none">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const active = spanDays === preset.days
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => applyPreset(preset.days)}
              disabled={isPending}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "bg-insight-positive text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-night-850 dark:text-night-300 dark:hover:bg-night-800"
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-stone-500 dark:text-night-500">From</span>
        <input
          type="date"
          value={draftStart}
          max={draftEnd || undefined}
          onChange={(event) => setDraftStart(event.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-insight-positive focus:outline-none dark:border-night-700 dark:bg-night-875 dark:text-night-50 [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-stone-500 dark:text-night-500">To</span>
        <input
          type="date"
          value={draftEnd}
          min={draftStart || undefined}
          onChange={(event) => setDraftEnd(event.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-insight-positive focus:outline-none dark:border-night-700 dark:bg-night-875 dark:text-night-50 [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>

      <button
        type="button"
        onClick={() => pushRange(draftStart, draftEnd)}
        disabled={!canApply || isPending}
        className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 dark:bg-night-100 dark:text-night-950 dark:hover:bg-white"
      >
        {isPending ? "Applying..." : "Apply"}
      </button>

      <span className="text-xs text-stone-500 dark:text-night-500">
        {spanDays.toLocaleString("en-IN")} day{spanDays === 1 ? "" : "s"}
      </span>
    </div>
  )
}
