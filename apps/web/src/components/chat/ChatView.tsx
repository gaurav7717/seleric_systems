"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart, isToolUIPart, DynamicToolUIPart, type UIMessage } from "ai"
import { useState, useRef, useEffect } from "react"
import { ChainOfThought } from "@/components/chat/ChainOfThought"
import { AssistantMarkdown } from "@/components/chat/AssistantMarkdown"
import { InsightCanvas } from "@/components/chat/insight/InsightCanvas"
import { partitionAssistantMessage } from "@/lib/chat/partition-message"
import { isToolRunning } from "@/lib/chat/tool-part"
import { ToolResult } from "@/components/chat/ToolResult"

const SUGGESTED = [
  "How are we doing today?",
  "Give me CAC and LTV from April 2025 to April 2026",
  "Show me the last 7 days P&L trend",
  "Which channel is performing best?",
  "Show me last 30 days revenue vs spend",
]

function UserBubble({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-stone-200/80 dark:bg-night-850 text-stone-900 dark:text-night-50 px-4 py-3 text-sm leading-relaxed rounded-tr-sm max-w-[85%] ml-auto">
      {text}
    </div>
  )
}

function StreamingStatus({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-stone-500 dark:text-night-500 font-sans" role="status" aria-live="polite">
      <span className="inline-block w-4 h-4 border-2 border-stone-400 dark:border-night-600 border-t-stone-700 dark:border-t-night-200 rounded-full animate-spin shrink-0" />
      <span>{label}</span>
    </div>
  )
}

function AssistantMessage({ msg, isStreaming }: { msg: UIMessage; isStreaming?: boolean }) {
  const partitioned = partitionAssistantMessage(msg)
  const narrative = partitioned.narrativeParts.join("\n\n").trim()
  const anyToolRunning = msg.parts.some((p) => isToolRunning(p))
  const allStepsDone = partitioned.cotSteps.length > 0 && partitioned.cotSteps.every((s) => s.state === "done")
  const waitingForNarrative = isStreaming && !narrative && allStepsDone
  // Between tool calls: streaming but no active tool and not all steps done yet (model is deciding next step)
  const betweenSteps = isStreaming && !anyToolRunning && !waitingForNarrative && partitioned.hasToolActivity && !allStepsDone
  // Initial thinking: streaming but no tools have started yet
  const initialThinking = isStreaming && !partitioned.hasToolActivity && !narrative

  return (
    <div className="w-full min-w-0">
      {partitioned.hasToolActivity && (
        <ChainOfThought steps={partitioned.cotSteps} isActive={isStreaming} />
      )}

      {partitioned.mergedData && <InsightCanvas merged={partitioned.mergedData} />}

      {partitioned.mergedData && !narrative && !isStreaming && (
        <p className="text-xs text-stone-400 dark:text-night-600 font-sans mt-2 italic">
          See insights above from compiled data. Add a follow-up for deeper analysis.
        </p>
      )}

      {/* Fallback: tools still loading or non-data tools without merged rows */}
      {!partitioned.mergedData &&
        msg.parts.map((part, i) => {
          if (isToolUIPart(part)) {
            return <ToolResult key={i} part={part as DynamicToolUIPart} renderMode="inline" />
          }
          return null
        })}

      {narrative && <AssistantMarkdown content={narrative} />}

      {initialThinking && (
        <StreamingStatus label="Thinking…" />
      )}
      {isStreaming && anyToolRunning && (
        <StreamingStatus label="Fetching live data from Cube…" />
      )}
      {betweenSteps && (
        <StreamingStatus label="Preparing next query…" />
      )}
      {waitingForNarrative && (
        <StreamingStatus label="Building charts and analysis…" />
      )}
    </div>
  )
}

export function ChatView() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const [input, setInput] = useState("")
  const isLoading = status === "submitted" || status === "streaming"
  const isError = status === "error"
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  function handleSuggestion(text: string) {
    setInput(text)
    inputRef.current?.focus()
  }

  function submit() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")
    sendMessage({ text })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-stone-50 dark:bg-night-950">
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-stone-900 dark:text-night-50 mb-1 font-sans">BI Assistant</h2>
              <p className="text-stone-500 dark:text-night-500 text-sm font-sans">
                Ask anything about your revenue, spend, and P&amp;L
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-stone-300 dark:border-night-800 bg-white dark:bg-night-900 px-4 py-2 text-sm text-stone-700 dark:text-night-200 hover:border-stone-400 dark:hover:border-night-700 hover:bg-stone-50 dark:hover:bg-night-875 transition-colors font-sans"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-8">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1
              const isStreamingMsg = isLoading && isLast && msg.role === "assistant"
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <UserBubble
                      text={
                        msg.parts
                          .filter(isTextUIPart)
                          .map((p) => p.text)
                          .join("") || ""
                      }
                    />
                  ) : (
                    <div className="w-full max-w-full">
                      <AssistantMessage msg={msg} isStreaming={isStreamingMsg} />
                    </div>
                  )}
                </div>
              )
            })}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <StreamingStatus label="Starting analysis…" />
            )}

            {isError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 font-sans">
                <span className="shrink-0 font-semibold">Error</span>
                <span>
                  {error?.message ?? "The model returned an error. Check the server logs panel for details."}
                  {" "}Try rephrasing your question or check that the Azure/Kimi endpoint is reachable.
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-stone-200 dark:border-night-800 bg-white dark:bg-night-925 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="relative"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about revenue, spend, P&L, trends…"
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-stone-300 dark:border-night-800 bg-stone-50 dark:bg-night-900 px-4 py-3 pr-12 text-sm text-stone-900 dark:text-night-50 placeholder:text-stone-400 dark:placeholder:text-night-600 focus:outline-none focus:border-stone-400 dark:focus:border-night-700 focus:ring-1 focus:ring-stone-300 dark:focus:ring-night-800 disabled:opacity-50 font-sans"
              style={{ minHeight: "48px", maxHeight: "200px" }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = "auto"
                t.style.height = `${Math.min(t.scrollHeight, 200)}px`
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3 rounded-lg bg-stone-800 dark:bg-night-50 dark:text-night-950 p-1.5 text-white hover:bg-stone-700 dark:hover:bg-night-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <p className="text-center text-xs text-stone-400 dark:text-night-600 mt-2 font-sans">
            Live data from Seleric · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
