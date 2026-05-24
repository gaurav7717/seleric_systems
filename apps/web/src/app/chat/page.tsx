import dynamic from "next/dynamic"

/** AI SDK chat hooks must run client-only — avoids SSR context errors with usePathname overlay. */
const ChatView = dynamic(
  () => import("@/components/chat/ChatView").then((m) => m.ChatView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center text-sm text-slate-500">
        Loading chat…
      </div>
    ),
  }
)

export default function ChatPage() {
  return <ChatView />
}
