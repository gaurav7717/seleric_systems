import axios from "axios"
import pino from "pino"

const logger = pino({ name: "processor:pipeboard" })

export async function executePipeboardWrite(
  actionType: string,
  payload: Record<string, unknown>,
) {
  if (process.env.WRITE_ENABLED !== "true") {
    throw new Error("WRITE_ENABLED is not true — Pipeboard writes blocked")
  }

  const url = process.env.PIPEBOARD_MCP_URL ?? "https://meta-ads.mcp.pipeboard.co"
  const response = await axios.post(`${url}/actions/${actionType}`, payload, {
    headers: {
      Authorization: `Bearer ${process.env.PIPEBOARD_TOKEN ?? ""}`,
    },
  })
  logger.info({ actionType, status: response.status }, "pipeboard_write_complete")
  return response.data
}
