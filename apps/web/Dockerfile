FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

FROM base AS development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
RUN pnpm install --filter @multiagent/web...
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile --filter @multiagent/web...
WORKDIR /app/apps/web
RUN pnpm build
CMD ["pnpm", "start"]
