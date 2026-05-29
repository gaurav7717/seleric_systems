import "server-only"

import { daysAgoIST, todayIST } from "@/lib/chat/dates"

export const DEFAULT_DASHBOARD_RANGE_DAYS = 30
export const MAX_DASHBOARD_RANGE_DAYS = 365

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface DashboardDateRange {
  start: string
  end: string
  spanDays: number
  isDefault: boolean
}

export type DashboardSearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isIsoDate(value: string | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false

  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function toUtcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, days: number): string {
  const date = toUtcDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

function diffDays(start: string, end: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / msPerDay)
}

function defaultRange(): DashboardDateRange {
  const end = todayIST()
  const start = daysAgoIST(DEFAULT_DASHBOARD_RANGE_DAYS - 1)
  return {
    start,
    end,
    spanDays: diffDays(start, end) + 1,
    isDefault: true,
  }
}

function normalizeDashboardDateRange(start: string, end: string, isDefault: boolean): DashboardDateRange {
  let normalizedStart = start <= end ? start : end
  const normalizedEnd = start <= end ? end : start

  const maxDiff = MAX_DASHBOARD_RANGE_DAYS - 1
  if (diffDays(normalizedStart, normalizedEnd) > maxDiff) {
    normalizedStart = addDays(normalizedEnd, -maxDiff)
  }

  return {
    start: normalizedStart,
    end: normalizedEnd,
    spanDays: diffDays(normalizedStart, normalizedEnd) + 1,
    isDefault,
  }
}

export function parseDashboardDateRange(searchParams?: DashboardSearchParams): DashboardDateRange {
  const rawStart = firstParam(searchParams?.start)
  const rawEnd = firstParam(searchParams?.end)

  if (!rawStart && !rawEnd) return defaultRange()
  if (!isIsoDate(rawStart) || !isIsoDate(rawEnd)) return defaultRange()

  return normalizeDashboardDateRange(rawStart, rawEnd, false)
}

export function toCubeDateRange(range: DashboardDateRange): [string, string] {
  return [range.start, range.end]
}

export function priorDateRange(range: DashboardDateRange): [string, string] {
  const priorEnd = addDays(range.start, -1)
  const priorStart = addDays(priorEnd, -(range.spanDays - 1))
  return [priorStart, priorEnd]
}

export function dateRangeLabel(range: DashboardDateRange): string {
  return `${range.start} → ${range.end}`
}
