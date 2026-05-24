import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai"
import { loadSchema } from "@/lib/cube-client"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import { resolveChatModel, getChatProviderInfo } from "@/lib/chat/model"
import { createChatTools } from "@/lib/chat/tools"

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []

  const schema = await loadSchema()

  const result = streamText({
    model: resolveChatModel(),
    system: buildChatSystemPrompt(schema),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(15),
    tools: createChatTools(schema),
  })

  return result.toUIMessageStreamResponse()
}

export async function GET() {
  return Response.json(getChatProviderInfo())
}
