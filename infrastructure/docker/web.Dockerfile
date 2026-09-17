# Development image for apps/web-superadmin. Built from the monorepo root
# context so pnpm workspace packages (design-tokens, ui, contracts) resolve.
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web-superadmin/package.json ./apps/web-superadmin/package.json
COPY packages ./packages

RUN pnpm install --filter @superadmin/web-superadmin... --frozen-lockfile || pnpm install --filter @superadmin/web-superadmin...

COPY apps/web-superadmin ./apps/web-superadmin

WORKDIR /app/apps/web-superadmin
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]
