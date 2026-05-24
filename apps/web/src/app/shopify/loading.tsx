export default function ShopifyLoading() {
  return (
    <main className="p-6 space-y-6">
      <div className="h-8 w-56 rounded-lg bg-slate-800 animate-pulse" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        ))}
      </div>
    </main>
  )
}
