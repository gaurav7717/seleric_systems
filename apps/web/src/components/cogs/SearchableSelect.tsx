"use client"

import { useEffect, useRef, useState } from "react"

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  className = "",
  inputClassName = "",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ""

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    setActiveIdx(-1)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function openDropdown() {
    setOpen(true)
    setQuery("")
    setActiveIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(val: string) {
    onChange(val)
    setOpen(false)
    setQuery("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) {
        select(filtered[activeIdx].value)
      } else if (filtered.length === 1) {
        select(filtered[0].value)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx] as HTMLElement | undefined
      item?.scrollIntoView({ block: "nearest" })
    }
  }, [activeIdx])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={openDropdown}
        className={`flex w-full items-center justify-between gap-1 rounded border border-stone-300 dark:border-night-700 bg-white dark:bg-night-875 px-2 py-1.5 text-sm text-stone-900 dark:text-night-50 focus:border-insight-positive focus:outline-none text-left ${inputClassName}`}
      >
        <span className="truncate">{value ? selectedLabel : <span className="text-stone-400 dark:text-night-500">{placeholder}</span>}</span>
        <svg className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-night-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-stone-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-lg">
          <div className="p-1.5 border-b border-stone-100 dark:border-night-800">
            <div className="flex items-center gap-1.5 rounded-md border border-stone-200 dark:border-night-700 bg-stone-50 dark:bg-night-875 px-2 py-1">
              <svg className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-night-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search…"
                className="min-w-0 flex-1 bg-transparent text-xs text-stone-900 dark:text-night-50 placeholder:text-stone-400 dark:placeholder:text-night-500 focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="shrink-0 text-stone-400 hover:text-stone-600 dark:text-night-500 dark:hover:text-night-300">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <ul ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-stone-400 dark:text-night-500">No results</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  onMouseDown={() => select(opt.value)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`cursor-pointer px-3 py-1.5 text-xs ${
                    opt.value === value
                      ? "bg-insight-positive/10 text-insight-positive font-medium"
                      : idx === activeIdx
                        ? "bg-stone-100 dark:bg-night-800 text-stone-900 dark:text-night-50"
                        : "text-stone-700 dark:text-night-200 hover:bg-stone-50 dark:hover:bg-night-850"
                  }`}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
