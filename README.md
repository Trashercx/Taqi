# Superadmin SaaS — Perú

Plataforma Superadmin para una futura plataforma SaaS multiempresa de
inventario y gestión tributaria en Perú. Esta etapa construye únicamente el
ecosistema Superadmin (gestión de clientes, licencias, planes, consumo,
finanzas internas y auditoría) que el propietario de la plataforma usará
para operar el negocio. El inventario del cliente y la integración con
SUNAT quedan preparados arquitectónicamente, pero no se implementan todavía.

El plan completo (visión, alcance, arquitectura, roles, roadmap, backlog)
vive en [`PLANTEAMIENTO_SUPERADMIN.md`](./PLANTEAMIENTO_SUPERADMIN.md). La
referencia visual del producto vive en [`DESIGN.md`](./DESIGN.md). Este
README cubre cómo correr el proyecto localmente (Docker). Para desplegarlo
en AWS paso a paso, ver [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md).

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, Tailwind CSS v4.
- **Backend:** NestJS (API REST versionada `/api/v1`), Prisma + PostgreSQL,
  Redis, BullMQ.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Infraestructura de desarrollo:** Docker Compose (Postgres, Redis, api,
  worker, web).

## Estructura

```text
/apps
  /web-superadmin   Frontend (Vite + React)
  /api              API REST (NestJS)
  /worker           Procesos asíncronos (BullMQ + Redis)
/packages
  /design-tokens    Tokens de DESIGN.md (CSS vars + Tailwind v4 @theme)
  /config-typescript  tsconfig base compartido
  /eslint-config      config de ESLint compartida
  /ui, /contracts, /testing, /observability  Paquetes compartidos (en crecimiento)
/infrastructure
  /docker           docker-compose.yml y Dockerfiles de desarrollo
/docs
  /adr              Decisiones de arquitectura
  /product          Threat model y otros artefactos de producto
```

## Requisitos

- Node.js 20 (ver `.nvmrc`)
- pnpm 9 (`corepack enable pnpm && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop (para Postgres y Redis locales)

## Primeros pasos

```bash
pnpm install

# Levanta Postgres y Redis (no el api/worker/web, para poder correrlos
# directamente con hot-reload desde el host):
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# Copia las variables de entorno de ejemplo:
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web-superadmin/.env.example apps/web-superadmin/.env

# Aplica el esquema de base de datos:
pnpm --filter @superadmin/api prisma:migrate

# Crea los roles/capacidades base y un usuario Platform Owner inicial:
pnpm --filter @superadmin/api seed

# Corre todo en modo desarrollo (api + worker + web en paralelo):
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/v1 (health check en `/api/v1/health`)

Alternativa: `docker compose -f infrastructure/docker/docker-compose.yml up`
levanta los cinco servicios (postgres, redis, api, worker, web) en
contenedores con hot-reload por volumen.

## Scripts del monorepo

| Script | Qué hace |
|---|---|
| `pnpm dev` | Corre todas las apps en modo desarrollo (Turborepo) |
| `pnpm build` | Build de producción de todas las apps |
| `pnpm lint` | ESLint en todos los paquetes |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes |
| `pnpm test` | Pruebas unitarias (Jest en `api`, Vitest en `worker`/`web-superadmin`) |
| `pnpm test:e2e` | Pruebas end-to-end de la API |

## Estado del roadmap

- **Fase 0 — Descubrimiento y base:** completa (monorepo, Docker, CI, tokens
  de diseño, app shell, ADR iniciales, threat model preliminar).
- **Fase 1 — Identidad y organizaciones:** completa (login, MFA, RBAC por
  capacidades, organizaciones, usuarios, auditoría append-only).
- **Fase 2 — Licencias y planes:** completa (máquina de estados de
  licencias, versionado inmutable de planes).
- **Fase 3 — Medición de consumo y cuotas:** completa (eventos de uso,
  agregados por hora/día, estado de cuota contra el plan activo).
- **Fase 4 — Finanzas internas:** completa (ingresos/gastos, optimistic
  locking, anulación sin borrado físico, dashboard de flujo de caja/MRR).
- **Frontend (`web-superadmin`):** conectado a todo lo anterior — login con
  MFA, clientes, usuarios, licencias, planes, consumo y finanzas operan con
  datos reales. Alertas, Salud del sistema y Configuración siguen como
  placeholders: no tienen backend todavía.
- **Código de despliegue a AWS:** listo (Dockerfiles de producción
  multi-stage, definiciones de tarea de ECS, políticas de IAM, pipeline de
  CI/CD) — ver [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md). La
  infraestructura en sí todavía no está aprovisionada: esa guía es para
  crearla a mano desde la consola.

No implementado todavía (documentado explícitamente en el código, no
descuidos): adjuntos de sustento (necesitan el bucket S3 de la guía),
agregación asíncrona de consumo vía cola/worker, vencimiento automático de
licencias por paso del tiempo, y el módulo de Alertas (SS6.8).

Ver el roadmap completo y las fases siguientes en
[`PLANTEAMIENTO_SUPERADMIN.md §16`](./PLANTEAMIENTO_SUPERADMIN.md#16-roadmap-de-implementación).

## Documentación

- [Plan maestro](./PLANTEAMIENTO_SUPERADMIN.md)
- [Referencia de diseño](./DESIGN.md)
- [ADR 0001 — Monolito modular](./docs/adr/0001-monolito-modular.md)
- [ADR 0002 — Multi-tenancy por `organization_id`](./docs/adr/0002-multi-tenancy-organization-id.md)
- [Threat model inicial](./docs/product/threat-model-inicial.md)

## Límites del producto

Este software no reemplaza a un contador colegiado ni constituye asesoría
tributaria. Los flujos financieros internos son para uso administrativo del
propietario de la plataforma, no contabilidad completa de los clientes. Ver
`PLANTEAMIENTO_SUPERADMIN.md §1` para el detalle de límites funcionales y
protección de datos personales.
