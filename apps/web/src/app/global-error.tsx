"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-200">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold">Application error</h2>
          <p className="max-w-md text-sm text-slate-400">{error.message}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
