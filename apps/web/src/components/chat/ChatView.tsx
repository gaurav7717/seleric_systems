"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isTextUIPart, isToolUIPart, type UIMessage } from "ai"
import { useState, useRef, useEffect } from "react"
import { AssistantMarkdown } from "@/components/chat/AssistantMarkdown"
import { InsightCanvas } from "@/components/chat/insight/InsightCanvas"
import { partitionAssistantMessage, type ClarifyPrompt } from "@/lib/chat/partition-message"
import { isToolRunning } from "@/lib/chat/tool-part"

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

function ClarifyBubble({ prompt, onSelect }: { prompt: ClarifyPrompt; onSelect: (answer: string) => void }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 font-sans">
      <p className="text-sm text-stone-800 dark:text-night-100 mb-2">{prompt.question}</p>
      {prompt.options && prompt.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prompt.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className="rounded-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-night-900 px-3 py-1 text-xs text-stone-700 dark:text-night-200 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
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

function AssistantMessage({
  msg,
  isStreaming,
  onClarify,
}: {
  msg: UIMessage
  isStreaming?: boolean
  onClarify: (answer: string) => void
}) {
  const partitioned = partitionAssistantMessage(msg)
  const narrative = partitioned.narrativeParts.join("\n\n").trim()
  const anyToolRunning = msg.parts.some((p) => isToolRunning(p))
  const hasData = !!partitioned.mergedData
  const initialThinking = isStreaming && !partitioned.hasToolActivity && !narrative

  return (
    <div className="w-full min-w-0">
      {hasData && <InsightCanvas merged={partitioned.mergedData!} />}

      {narrative && (
        <>
          {hasData && (
            <div className="flex items-center gap-3 mt-5 mb-1">
              <div className="flex-1 h-px bg-stone-200 dark:bg-night-800" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-stone-400 dark:text-night-600 font-sans shrink-0">Analysis</span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-night-800" />
            </div>
          )}
          <AssistantMarkdown content={narrative} />
        </>
      )}

      {partitioned.clarifyPrompt && !isStreaming && (
        <ClarifyBubble prompt={partitioned.clarifyPrompt} onSelect={onClarify} />
      )}

      {initialThinking && <StreamingStatus label="Thinking…" />}
      {isStreaming && anyToolRunning && <StreamingStatus label="Fetching live data…" />}
      {isStreaming && !anyToolRunning && partitioned.hasToolActivity && !narrative && (
        <StreamingStatus label="Building analysis…" />
      )}
    </div>
  )
}

function parseStreamError(err: Error | undefined): { isRateLimit: boolean; message: string } {
  if (!err) return { isRateLimit: false, message: "The model returned an error." }
  const raw = err.message ?? ""
  const isRateLimit = /too_many_requests|rate.?limit|429/i.test(raw)
  if (isRateLimit) {
    return {
      isRateLimit: true,
      message: "The primary model hit a rate limit mid-response. The results above are partial. Retrying will use the fallback model.",
    }
  }
  // Strip raw JSON from the message — show a clean fallback instead
  const looksLikeJson = raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")
  return {
    isRateLimit: false,
    message: looksLikeJson
      ? "The model returned an error. Check the server logs panel for details."
      : raw,
  }
}

export function ChatView() {
  const { messages, sendMessage, regenerate, setMessages, status, error } = useChat({
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

  function handleClarify(answer: string) {
    if (isLoading) return
    sendMessage({ text: answer })
  }

  function handleRetry() {
    if (isLoading) return
    // Strip consecutive duplicate user messages created by previous failed retries,
    // then regenerate — this avoids adding yet another user turn.
    setMessages((prev) => {
      const trimmed = [...prev]
      // Remove any trailing assistant message that failed
      if (trimmed.length > 0 && trimmed[trimmed.length - 1].role === "assistant") {
        trimmed.pop()
      }
      // Collapse consecutive duplicate user messages down to one
      while (trimmed.length >= 2) {
        const last = trimmed[trimmed.length - 1]
        const prev2 = trimmed[trimmed.length - 2]
        const lastText = last.parts.filter(isTextUIPart).map((p) => p.text).join("")
        const prevText = prev2.parts.filter(isTextUIPart).map((p) => p.text).join("")
        if (last.role === "user" && prev2.role === "user" && lastText === prevText) {
          trimmed.pop()
        } else {
          break
        }
      }
      return trimmed
    })
    regenerate()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const empty = messages.length === 0

  // Collapse consecutive duplicate user messages (defensive — setMessages cleanup handles this
  // on retry, but guards against any edge case where duplicates slip through to render).
  const displayMessages = messages.filter((msg, i) => {
    if (msg.role !== "user" || i === 0) return true
    const prev = messages[i - 1]
    if (prev.role !== "user") return true
    const text = msg.parts.filter(isTextUIPart).map((p) => p.text).join("")
    const prevText = prev.parts.filter(isTextUIPart).map((p) => p.text).join("")
    return text !== prevText
  })

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
            {displayMessages.map((msg, index) => {
              const isLast = index === displayMessages.length - 1
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
                      <AssistantMessage msg={msg} isStreaming={isStreamingMsg} onClarify={handleClarify} />
                    </div>
                  )}
                </div>
              )
            })}

            {isLoading && displayMessages[displayMessages.length - 1]?.role === "user" && (
              <StreamingStatus label="Starting analysis…" />
            )}

            {isError && (() => {
              const { isRateLimit, message } = parseStreamError(error)
              return (
                <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-sans ${isRateLimit ? "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200" : "border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"}`}>
                  <span className="shrink-0 font-semibold">{isRateLimit ? "Rate limit" : "Error"}</span>
                  <span className="flex-1">{message}</span>
                  <button
                    onClick={handleRetry}
                    className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${isRateLimit ? "bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-100" : "bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-900 dark:text-red-100"}`}
                  >
                    Retry
                  </button>
                </div>
              )
            })()}

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
