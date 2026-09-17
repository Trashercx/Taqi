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
COPY packages ./packages

RUN pnpm install --filter @superadmin/api... --frozen-lockfile || pnpm install --filter @superadmin/api...

COPY apps/api ./apps/api

WORKDIR /app/apps/api
# El postinstall de @prisma/client no encuentra el schema cuando corre desde
# la raiz del workspace filtrado; se genera el cliente explicitamente aqui,
# ya con el codigo fuente completo copiado.
RUN npx prisma generate

EXPOSE 3001
CMD ["pnpm", "run", "dev"]
