"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"

interface ChannelRow {
  channel: string
  revenue?: number
  adSpend?: number
  netProfit?: number
  orders?: number
  [key: string]: unknown
}

interface Props {
  rows: ChannelRow[] | Record<string, unknown>[]
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`
  if (Math.abs(v) >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-1">
          {p.name}: {fmtK(p.value)}
        </p>
      ))}
    </div>
  )
}

export function ChannelChart({ rows }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No channel data.</p>

  // Normalized format from getChannelBreakdown (has .channel key)
  const normalized = (rows as ChannelRow[]).every((r) => "channel" in r)

  let data: Array<{ channel: string; Revenue: number; "Ad Spend": number; "Net Profit": number }>

  if (normalized) {
    data = (rows as ChannelRow[]).map((r) => ({
      channel: r.channel,
      Revenue: Number(r.revenue ?? 0),
      "Ad Spend": Number(r.adSpend ?? 0),
      "Net Profit": Number(r.netProfit ?? 0),
    }))
  } else {
    // Fallback: auto-detect channel key for raw cube_query results
    const keys = Object.keys(rows[0] ?? {})
    const channelKey = keys.find((k) => /platform|channel|source/i.test(k)) ?? keys[0]
    const revKey = keys.find((k) => /revenue|sales/i.test(k) && !/cogs/i.test(k))
    const spendKey = keys.find((k) => /spend|cost/i.test(k))
    const profitKey = keys.find((k) => /net_profit|profit/i.test(k))
    data = (rows as Record<string, unknown>[]).map((r) => ({
      channel: String(r[channelKey] ?? "Unknown"),
      Revenue: Number(revKey ? r[revKey] : 0),
      "Ad Spend": Number(spendKey ? r[spendKey] : 0),
      "Net Profit": Number(profitKey ? r[profitKey] : 0),
    }))
  }

  return (
    <div className="my-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="channel" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={62} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          <Bar dataKey="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Ad Spend" fill="#f97316" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Net Profit" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
