import "server-only"

import { daysAgoIST, todayIST } from "@/lib/chat/dates"

/** Cube relative range — IST applied via query timezone. */
export const LAST_30_DAYS = "last 30 days" as const

/** Explicit IST [start, end] for prior-period comparisons. */
export function istDateRange(days: number): [string, string] {
  return [daysAgoIST(days), todayIST()]
}

export function priorIstDateRange(days: number): [string, string] {
  return [daysAgoIST(days * 2), daysAgoIST(days)]
}
