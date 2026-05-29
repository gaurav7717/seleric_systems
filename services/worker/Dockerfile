FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types packages/shared-types
COPY packages/db packages/db
COPY services/worker services/worker

RUN pnpm install --frozen-lockfile --filter @multiagent/worker... \
    && pnpm --filter @multiagent/db generate

WORKDIR /app/services/worker

ENV NODE_ENV=production

CMD ["pnpm", "exec", "tsx", "src/index.ts"]
