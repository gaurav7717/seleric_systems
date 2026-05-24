import pino from "pino"

import { registerWorkers } from "./queues"

const logger = pino({ name: "worker" })

async function main() {
  logger.info("worker_starting")
  await registerWorkers()
  logger.info("worker_ready")
}

main().catch((err) => {
  logger.error({ err }, "worker_failed")
  process.exit(1)
})
