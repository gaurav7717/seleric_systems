"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-stone-900">Something went wrong</h2>
      <p className="max-w-md text-sm text-slate-400">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500"
      >
        Try again
      </button>
    </div>
  )
}
