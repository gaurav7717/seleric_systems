import { ThemeToggle } from "./ThemeToggle"

export function Header() {
  return (
    <header className="border-b border-stone-200 dark:border-night-800 bg-white dark:bg-night-925 px-6 py-4 flex items-center justify-between">
      <span className="text-sm font-medium text-stone-800 dark:text-night-100">Seleric BI</span>
      <ThemeToggle />
    </header>
  )
}
