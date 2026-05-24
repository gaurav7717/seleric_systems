import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-night-950">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
