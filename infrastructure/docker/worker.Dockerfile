# Development image for apps/worker. Built from the monorepo root context so
# pnpm workspace packages resolve.
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages ./packages

RUN pnpm install --filter @superadmin/worker... --frozen-lockfile || pnpm install --filter @superadmin/worker...

COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
CMD ["pnpm", "run", "dev"]
