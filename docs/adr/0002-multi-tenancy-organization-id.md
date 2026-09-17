# 0002 — Multi-tenancy por `organization_id` en base compartida

**Estado:** Aceptado
**Fecha:** 2026-09-17

## Contexto

`PLANTEAMIENTO_SUPERADMIN.md` §4 exige que la plataforma sea multi-tenant
desde el inicio: cada organización cliente (`organization`) debe estar
completamente aislada de las demás. El riesgo dominante para un SaaS B2B es
el acceso cruzado entre organizaciones (IDOR), listado como caso crítico en
§15.

## Decisión

- Base de datos y esquema **compartidos** para todas las organizaciones en
  el MVP (no aislamiento por base de datos por cliente).
- Toda tabla perteneciente a un cliente incluye `organization_id`.
- `organization_id` **nunca** se acepta como parámetro de entrada del
  cliente (body, query o path) como prueba de autorización. Se obtiene
  siempre del contexto autenticado (el JWT / sesión del usuario) y se aplica
  como filtro obligatorio en la capa de repositorio, no solo en el
  controlador.
- Aislamiento por base de datos dedicada queda como modalidad futura solo
  para clientes empresariales con exigencias especiales (§4), no como
  default.

## Consecuencias

- Cada endpoint que toca datos de una organización necesita una prueba de
  aislamiento automatizada (otro tenant no puede leer ni escribir sus
  datos) — parte obligatoria de la Definición de Terminado (§15).
- Los repositorios deben tener un único punto de entrada que inyecte el
  filtro `organization_id`, para evitar que un desarrollador (humano o
  agente) lo omita accidentalmente en una query nueva.
- Migrar un cliente a base de datos dedicada más adelante es un cambio de
  infraestructura, no de modelo de dominio, porque el código ya asume
  `organization_id` como límite de acceso.
