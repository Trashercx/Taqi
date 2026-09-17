# Development image for apps/api. Built from the monorepo root context so
# pnpm workspace packages (design-tokens, contracts, config-*) resolve.
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# argon2 no publica binarios prebuilt para toda combinacion de plataforma;
# estas herramientas permiten compilarlo desde codigo fuente si hace falta.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/package.json
# El postinstall del paquete ("prisma generate") necesita el schema
# presente ANTES del install, o falla con "Could not find Prisma Schema".
COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages

RUN pnpm install --filter @superadmin/api... --frozen-lockfile || pnpm install --filter @superadmin/api...

COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["pnpm", "run", "dev"]
