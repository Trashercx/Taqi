# Copilot instructions for Taqi

## Repository shape

This is a pnpm 9/Turborepo monorepo targeting Node.js 20. The product is the
Superadmin surface of a future multi-tenant SaaS for Peru; customer inventory
and SUNAT integration are intentionally out of scope for the current stage.

- `apps/api` is a versioned NestJS REST API (`/api/v1`) backed by PostgreSQL
  through Prisma. It is a modular monolith: each business area has its own
  Nest module, controller, services, DTOs, and tests.
- `apps/web-superadmin` is the React 19 + TypeScript + Vite dashboard. React
  Router owns routes; `AppShell` and `ProtectedRoute` wrap authenticated
  screens, and `src/lib/api-client.ts` is the shared API/auth boundary.
- `apps/worker` is a separate Redis-connected process intended for BullMQ
  jobs. It currently verifies Redis connectivity and handles graceful
  shutdown; do not assume queue processors exist yet.
- `packages/design-tokens` contains the CSS/Tailwind design tokens. The other
  packages provide shared contracts, UI/testing/observability packages, and
  TypeScript/ESLint configuration as they become used.
- `infrastructure/docker` contains the local Compose stack and development
  and production Dockerfiles. `docs/adr` records architectural decisions;
  consult it before changing module or tenancy boundaries.

The backend is deliberately a modular monolith rather than microservices.
The primary domains currently wired into `apps/api/src/app.module.ts` are
auth/MFA, RBAC, users, organizations, plans, licenses, usage, finance,
audit, health, and Prisma.

## Install, run, and infrastructure

Use the pinned toolchain from `.nvmrc` and `package.json`:

```bash
corepack enable pnpm
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

For host-based development, start only the dependencies, copy the three
`.env.example` files, apply migrations, seed the initial platform owner, and
then start the apps:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web-superadmin/.env.example apps/web-superadmin/.env
pnpm --filter @superadmin/api prisma:migrate
pnpm --filter @superadmin/api seed
pnpm dev
```

The dashboard is served at `http://localhost:5173`; the API is at
`http://localhost:3001/api/v1` and its health endpoint is
`/api/v1/health`. To run all five services in containers instead, use
`docker compose -f infrastructure/docker/docker-compose.yml up`.

## Build, lint, typecheck, and tests

Run these from the repository root for the same checks used by CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Turborepo runs the corresponding workspace task and builds dependencies first
where configured. The API lint script includes ESLint `--fix`, so inspect the
working tree after running the root lint command. Useful package-scoped
commands are:

```bash
pnpm --filter @superadmin/api lint
pnpm --filter @superadmin/api typecheck
pnpm --filter @superadmin/web-superadmin lint
pnpm --filter @superadmin/web-superadmin typecheck
pnpm --filter @superadmin/worker lint
pnpm --filter @superadmin/worker typecheck
```

Test runners differ by app:

- API unit tests use Jest:
  `pnpm --filter @superadmin/api test`
- Web and worker tests use Vitest:
  `pnpm --filter @superadmin/web-superadmin test`
  and `pnpm --filter @superadmin/worker test`
- API end-to-end tests use the separate Jest config:
  `pnpm --filter @superadmin/api test:e2e`

Run one test file without running the whole suite with the runner directly:

```bash
pnpm --filter @superadmin/api exec jest src/finance/month-key.spec.ts --runInBand
pnpm --filter @superadmin/api exec jest --config ./test/jest-e2e.json test/app.e2e-spec.ts --runInBand
pnpm --filter @superadmin/web-superadmin exec vitest run src/App.test.tsx
pnpm --filter @superadmin/worker exec vitest run src/redis.test.ts
```

The API E2E suite expects the configured PostgreSQL/Redis services and
environment variables. Keep database changes in a new Prisma migration under
`apps/api/prisma/migrations`; regenerate the client with
`pnpm --filter @superadmin/api prisma:generate` when the schema changes.

## Backend conventions

- Keep domain logic inside the corresponding Nest module. Controllers handle
  HTTP concerns; services own use cases and persistence orchestration. Do not
  reach into another module's private repository implementation; use exported
  services or an explicit event boundary.
- Add request DTOs under the domain's `dto` directory. `main.ts` enables a
  global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and
  transformation, so inputs must be represented by DTOs rather than
  unvalidated objects.
- Authorization is capability-based. Protect endpoints with the RBAC
  capability decorator/guard and use the authenticated request context; do not
  replace it with ad-hoc role-name checks.
- This is shared-schema multi-tenancy. Any customer-owned record is scoped by
  `organization_id`. Never accept `organization_id` from body, query, or path
  as proof of access; derive it from authenticated context and apply the
  filter in the service/repository query. Add an isolation test for new
  organization-scoped endpoints.
- Sensitive administrative actions must remain auditable. Use the existing
  `AuditService` patterns and preserve append-only audit semantics; do not
  silently delete or overwrite historical financial/audit records.
- Authentication uses short-lived JWT access tokens and persisted, revocable
  refresh sessions. Passwords, opaque tokens, MFA secrets, and IP data use the
  existing hashing/encryption helpers; do not log credentials or raw tokens.
  Platform Owner/Superadmin MFA requirements are enforced by the existing RBAC
  and auth flow.
- Prisma is the source of the database client and migrations. Preserve the
  existing snake_case database mapping and explicit relation/index behavior
  when extending `schema.prisma`.

## Frontend conventions

- Add pages under `apps/web-superadmin/src/pages` and wire them in `src/App.tsx`
  through the existing protected shell rather than bypassing route guards.
- Use `src/lib/api-client.ts` for API requests. It owns the base URL,
  authorization header, one refresh retry on `401`, and `ApiError` shaping;
  page components should not duplicate fetch/auth-refresh logic.
- Reuse the existing components (`DataTable`, form fields, feedback, modal,
  status badges, KPI cards) and the design-token package. Keep status labels
  and display formatting in the existing helpers instead of duplicating
  translations or API-to-UI mappings in pages.
- Add UI tests with Vitest and React Testing Library; the test setup is
  `src/test/setup.ts`.

## Documentation and delivery constraints

Use `README.md` for the supported local workflow,
`DOKPLOY_DEPLOYMENT_GUIDE.md` for the VPS/Dokploy path,
`PLANTEAMIENTO_SUPERADMIN.md` for product scope/roadmap, `DESIGN.md` for
visual tokens, and the ADRs for architecture. Update directly related
documentation when a behavior or workflow changes. CI runs install with the
frozen lockfile, then lint, typecheck, test, and build; keep changes compatible
with that order.
