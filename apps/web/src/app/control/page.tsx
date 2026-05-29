"use client"

import Link from "next/link"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ControlStats {
  pendingCount: number
  executedToday: number
  approvalRate: number | null
  avgOutcomeScore: number | null
  perAgent: Array<{ agent: string; proposalCount: number; approvalRate: number | null }>
}

const QUICK_LINKS = [
  { href: "/control/approvals", label: "Approvals", desc: "Review and act on pending agent actions" },
  { href: "/control/history", label: "History", desc: "Audit log of executed and failed actions" },
  { href: "/control/rules", label: "Rules", desc: "Configure guardrails and auto-approval rules" },
]

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-stone-900 dark:text-night-50 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-night-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function ControlPage() {
  const { data, isLoading } = useSWR<ControlStats>("/api/control/stats", fetcher, {
    refreshInterval: 30_000,
  })

  const pct = (n: number | null | undefined) =>
    n == null ? "—" : `${Math.round(n * 100)}%`

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Control Panel</h1>
        <p className="text-sm text-stone-500 dark:text-night-400 mt-1">
          Agent activity overview · last 7 days
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100 dark:bg-night-850 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Pending Approvals"
              value={data?.pendingCount?.toString() ?? "0"}
              sub="awaiting review"
            />
            <StatCard
              label="Executed Today"
              value={data?.executedToday?.toString() ?? "0"}
              sub="actions run"
            />
            <StatCard
              label="Approval Rate"
              value={pct(data?.approvalRate)}
              sub="last 7 days"
            />
            <StatCard
              label="Avg Outcome Score"
              value={data?.avgOutcomeScore == null ? "—" : data.avgOutcomeScore.toFixed(2)}
              sub="last 30 days"
            />
          </>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-stone-500 dark:text-night-400 uppercase tracking-wide mb-3">
          Navigate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 p-4 hover:border-stone-300 dark:hover:border-night-700 transition-colors group"
            >
              <p className="font-semibold text-stone-900 dark:text-night-50 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {link.label} →
              </p>
              <p className="text-xs text-stone-400 dark:text-night-500 mt-1">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {!isLoading && data?.perAgent && data.perAgent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 dark:text-night-400 uppercase tracking-wide mb-3">
            Per-Agent Breakdown (last 7d)
          </h2>
          <div className="rounded-xl border border-stone-200 dark:border-night-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-night-800 bg-stone-50 dark:bg-night-850">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-stone-500 dark:text-night-400 uppercase tracking-wide">
                    Agent
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 dark:text-night-400 uppercase tracking-wide">
                    Proposals
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 dark:text-night-400 uppercase tracking-wide">
                    Approval Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.perAgent.map((row, i) => (
                  <tr
                    key={row.agent}
                    className={`border-b last:border-0 border-stone-100 dark:border-night-800 ${
                      i % 2 === 0 ? "bg-white dark:bg-night-900" : "bg-stone-50/50 dark:bg-night-850/50"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-700 dark:text-night-200">
                      {row.agent}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-600 dark:text-night-300">
                      {row.proposalCount}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-600 dark:text-night-300">
                      {pct(row.approvalRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
