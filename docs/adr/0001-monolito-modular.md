# 0001 — Monolito modular en lugar de microservicios para el MVP

**Estado:** Aceptado
**Fecha:** 2026-09-17

## Contexto

`PLANTEAMIENTO_SUPERADMIN.md` §3.1 exige decidir la forma de despliegue del
backend antes de escribir código. El sistema tiene dominios claramente
separables (identidad, tenancy, clientes, planes/licencias, medición,
finanzas, notificaciones, auditoría, observabilidad, integraciones futuras),
pero el equipo es pequeño y el MVP debe entregarse en semanas, no meses.

## Decisión

Se construye un **monolito modular** dentro de `apps/api` (NestJS): un único
proceso desplegable, organizado internamente en módulos NestJS por dominio,
con límites de import explícitos (un módulo no accede a los repositorios
internos de otro; se comunica vía servicios exportados o eventos). No se
crean microservicios ni colas de mensajería entre dominios en esta etapa.

## Consecuencias

- Menor costo operativo: un solo contenedor `api` y un solo `worker` para
  trabajos asíncronos (ver `infrastructure/docker/docker-compose.yml`).
- Los límites de dominio deben mantenerse por disciplina de código (revisión
  adversarial, ver `PLANTEAMIENTO_SUPERADMIN.md` §12), no por aislamiento de
  red.
- Si el tráfico o el equipo crecen, un dominio con límites ya claros
  (por ejemplo medición de consumo) se puede extraer a un servicio
  independiente sin rediseñar el resto — ver §18 "Microservicios
  prematuros".
