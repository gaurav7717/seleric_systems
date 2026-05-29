import path from "path"
import { fileURLToPath } from "url"
import { config as dotenvConfig } from "dotenv"

// Load .env / .env.local from monorepo root so API routes see CUBE_MCP_URL etc.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "../..")
dotenvConfig({ path: path.join(root, ".env.local"), override: false })
dotenvConfig({ path: path.join(root, ".env"), override: false })

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@multiagent/shared-types", "@multiagent/db"],
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../.."),
  },
}

export default nextConfig
