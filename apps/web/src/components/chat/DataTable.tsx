"use client"

interface Props {
  rows: Record<string, unknown>[]
  label?: string
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—"
  if (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "")) {
    const n = Number(val)
    if (Math.abs(n) >= 1000) {
      return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    }
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
  }
  if (typeof val === "string" && val.includes("T00:00:00")) {
    return val.slice(0, 10)
  }
  return String(val)
}

function prettyHeader(key: string): string {
  return key
    .replace(/^[^.]+\./, "") // strip cube prefix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function DataTable({ rows, label }: Props) {
  if (!rows.length) {
    return <div className="text-xs text-slate-500 my-2">No data returned.</div>
  }

  const headers = Object.keys(rows[0])

  return (
    <div className="my-2">
      {label && <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap"
                >
                  {prettyHeader(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {formatValue(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-600 mt-1">{rows.length} row{rows.length !== 1 ? "s" : ""}</div>
    </div>
  )
}
