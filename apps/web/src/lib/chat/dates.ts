const IST = "Asia/Kolkata"

export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST })
}

export function daysAgoIST(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString("en-CA", { timeZone: IST })
}
