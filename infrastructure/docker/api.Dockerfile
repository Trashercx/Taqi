# Development image for apps/api. Built from the monorepo root context so
# pnpm workspace packages (design-tokens, contracts, config-*) resolve.
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages

RUN pnpm install --filter @superadmin/api... --frozen-lockfile || pnpm install --filter @superadmin/api...

COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["pnpm", "run", "dev"]
