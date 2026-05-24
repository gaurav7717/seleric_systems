"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function AssistantMarkdown({ content }: { content: string }) {
  if (!content.trim()) return null

  return (
    <div className="text-sm leading-relaxed text-stone-800 dark:text-night-200 font-serif mt-4">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-stone-900 dark:text-night-50">{children}</strong>,
          h3: ({ children }) => (
            <h3 className="font-sans font-semibold text-stone-900 dark:text-night-50 mt-4 mb-2 text-base">{children}</h3>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-stone-700 dark:text-night-300">{children}</li>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 font-serif">
              <table className="text-sm border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-stone-200 dark:border-night-800 px-3 py-2 text-left text-[10px] font-semibold uppercase text-stone-500 dark:text-night-500 font-sans">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-stone-100 dark:border-night-875 px-3 py-2 text-stone-800 dark:text-night-200">{children}</td>
          ),
          code: ({ children, className }) =>
            !className ? (
              <code className="bg-stone-100 dark:bg-night-875 text-stone-800 dark:text-night-200 rounded px-1 py-0.5 text-xs font-mono border border-stone-200 dark:border-night-800">
                {children}
              </code>
            ) : (
              <code className="block bg-stone-100 dark:bg-night-875 rounded-lg p-3 text-xs font-mono text-stone-700 dark:text-night-300 overflow-x-auto border border-stone-200 dark:border-night-800">
                {children}
              </code>
            ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
