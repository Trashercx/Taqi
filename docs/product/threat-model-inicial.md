# Threat model inicial — Superadmin SaaS

**Fecha:** 2026-09-17
**Alcance:** ecosistema Superadmin del MVP (`PLANTEAMIENTO_SUPERADMIN.md`).
No cubre la futura integración SUNAT ni el inventario del cliente, todavía
fuera de alcance.

Este documento se revisa y amplía en la Fase 5 (Endurecimiento y piloto,
§16). Es un punto de partida, no un análisis exhaustivo.

## Activos a proteger

1. Datos de organizaciones clientes (razón social, contactos, RUC).
2. Credenciales y sesiones de usuarios administrativos.
3. Estado de licencias (evita que alguien extienda o reactive sin permiso).
4. Movimientos financieros internos.
5. Bitácora de auditoría (integridad, no solo confidencialidad).

## Amenazas principales (STRIDE resumido)

| Categoría | Amenaza concreta | Mitigación planeada |
|---|---|---|
| Spoofing | Suplantación de sesión administrativa | MFA obligatorio (TOTP) para Platform Owner/Superadmin, JWT de vida corta + refresh revocable (§6.1) |
| Tampering | Alteración directa de `audit_logs` en base de datos | Tabla append-only a nivel de PostgreSQL + hash encadenado (§6.9, §8) |
| Repudiation | Un actor niega haber ejecutado una acción sensible | Auditoría con actor, motivo y diff antes/después en cada acción crítica (§6.9) |
| Information Disclosure | Acceso cruzado entre organizaciones (IDOR) | `organization_id` desde contexto autenticado, nunca del cliente (ADR 0002); pruebas de aislamiento por endpoint |
| Denial of Service | Abuso de endpoints públicos de auth (`/auth/login`, `/auth/password/forgot`) | Rate limiting y bloqueo progresivo (§6.1) |
| Elevation of Privilege | Un rol con pocos permisos ejecuta una acción reservada a otro rol | RBAC por capacidades verificadas en cada endpoint, no por `role === 'admin'` (§5) |

## Riesgos no cubiertos todavía

- Cifrado de credenciales de integraciones futuras (SUNAT) — se diseñará
  junto con `TaxAuthorityGateway` (§10).
- Cumplimiento formal de la Ley N.º 29733 — requiere validación legal antes
  del piloto con clientes reales (§1).
- Pruebas de penetración externas — no planeadas antes de la Fase 5.
