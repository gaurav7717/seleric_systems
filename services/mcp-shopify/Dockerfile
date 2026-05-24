FROM node:20-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/mcp-shopify services/mcp-shopify

RUN pnpm install --frozen-lockfile --filter @multiagent/mcp-shopify...

WORKDIR /app/services/mcp-shopify

ENV NODE_ENV=production
EXPOSE 3100

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
