# Plan maestro del sistema Superadmin para una plataforma SaaS de inventario y gestión tributaria en Perú

**Versión:** 1.0  
**Fecha:** 17 de septiembre de 2026  
**Alcance de esta etapa:** planeamiento del primer desarrollo, centrado en el ecosistema Superadmin. La integración operativa con SUNAT y el sistema de inventario de los clientes quedan preparados arquitectónicamente, pero no se implementan todavía.

---

## 1. Visión del producto

El proyecto será una plataforma SaaS multiempresa para negocios peruanos. A futuro permitirá administrar inventario, compras, ventas, documentos electrónicos y procesos de apoyo contable, con integración a SUNAT. Antes de construir esos módulos se desarrollará un **sistema Superadmin** desde el cual el propietario de la plataforma podrá:

- Registrar y administrar clientes o empresas suscritas.
- Crear usuarios de acceso para cada cliente.
- Emitir, renovar, suspender y revocar licencias.
- Definir planes, límites, módulos habilitados y precios.
- Ver cuánto tiempo queda de cada licencia.
- Medir consumo, tráfico, almacenamiento y actividad.
- Monitorear salud de servicios, errores y eventos relevantes.
- Registrar ingresos y gastos internos del proyecto.
- Consultar indicadores de ventas, costos, margen y flujo de caja.
- Mantener una bitácora auditable de acciones administrativas.
- Preparar la arquitectura para incorporar después inventarios y comunicación con SUNAT.

> **Límite funcional importante:** el producto podrá automatizar cálculos, registros y flujos tributarios, pero no debe presentarse legalmente como sustituto de un contador colegiado. Las reglas tributarias y la integración productiva con SUNAT deberán validarse con un especialista tributario peruano y con la documentación oficial vigente.

> **Protección de datos personales:** la plataforma tratará datos de empresas y personas (RUC, contactos, direcciones IP, actividad de usuarios). El diseño debe cumplir la Ley N.º 29733 de Protección de Datos Personales del Perú y su reglamento, incluyendo minimización de datos, base legal de tratamiento y atención de derechos ARCO. Esto debe validarse con asesoría legal peruana antes del piloto con clientes reales.

---

## 2. Objetivos del primer desarrollo

### Objetivo principal

Construir un MVP seguro y extensible del panel Superadmin que permita operar comercialmente las licencias del futuro sistema de inventario.

### Objetivos específicos

1. Contar con autenticación segura y autorización por roles.
2. Administrar el ciclo de vida completo de una licencia.
3. Registrar clientes, empresas, contactos y usuarios.
4. Medir consumo por licencia y por empresa.
5. Mostrar métricas operativas y comerciales en un dashboard.
6. Registrar ingresos y gastos del proyecto.
7. Generar alertas por vencimiento, exceso de cuota, errores y morosidad.
8. Mantener trazabilidad mediante auditoría inmutable a nivel de aplicación.
9. Dejar contratos de integración preparados para los futuros módulos de inventario y SUNAT.

### Fuera de alcance del MVP

- Emisión real de facturas, boletas, notas de crédito o débito.
- Firma de XML UBL 2.1 y envío productivo a SUNAT.
- Kardex, lotes, series, almacenes y movimientos de inventario del cliente.
- Contabilidad completa o presentación automática de declaraciones.
- Aplicación móvil nativa.
- Marketplace de integraciones.
- Cobro automatizado de suscripciones mediante pasarela de pago (Culqi, Niubiz, Mercado Pago u otra). En el MVP los pagos se registran manualmente en el módulo de Finanzas.
- Intranet o portal operativo para el cliente licenciatario (el futuro sistema de inventario que usarán los usuarios de la empresa cliente). Superadmin es exclusivamente la herramienta del propietario de la plataforma.

Aunque estos puntos no se implementan en esta etapa, el modelo de datos de licencias/suscripciones (`subscriptions`, `financial_transactions`) y el modelo de tenancy (`workspace`, `membership`) deben quedar preparados para incorporarlos después sin rediseño, sin construir la integración en sí.

---

## 3. Decisiones arquitectónicas

### 3.1 Enfoque recomendado

Se recomienda comenzar con un **monolito modular**, no con microservicios. Esto reduce costo y complejidad durante el MVP, pero conserva límites claros entre dominios para separar servicios más adelante si el tráfico lo requiere.

Dominios iniciales:

- Identidad y acceso.
- Tenancy y organizaciones.
- Clientes y contactos.
- Planes y licencias.
- Medición y cuotas.
- Finanzas internas.
- Notificaciones.
- Auditoría.
- Observabilidad.
- Integraciones futuras.

### 3.2 Stack tecnológico propuesto

#### Frontend

- React + TypeScript + Vite.
- React Router para navegación.
- TanStack Query para estado remoto, caché e invalidación.
- Zustand únicamente para estado local transversal pequeño.
- React Hook Form + Zod para formularios y validación.
- Tailwind CSS v4 para implementar los tokens del diseño.
- Radix UI como base accesible de primitives.
- TanStack Table para tablas densas, filtros y paginación.
- Recharts para gráficos del dashboard.
- Vitest + React Testing Library para pruebas.
- Playwright para pruebas end-to-end.

#### Backend

- Node.js con TypeScript.
- NestJS con API REST versionada.
- PostgreSQL como base de datos principal.
- Prisma ORM y migraciones versionadas.
- Redis para caché, cuotas, sesiones auxiliares y colas.
- BullMQ para alertas, correos, agregación de métricas y tareas programadas.
- OpenAPI/Swagger para documentar contratos.
- Pino para logs estructurados.
- OpenTelemetry para trazas y métricas.

#### Infraestructura

- Monorepo con pnpm y Turborepo.
- Docker Compose para desarrollo local.
- Contenedores separados para `web`, `api`, `worker`, PostgreSQL y Redis.
- CI/CD con lint, typecheck, tests, build, análisis de dependencias y migraciones controladas.
- Proveedor de nube: **AWS**.
- AWS Secrets Manager para credenciales y secretos, nunca secretos permanentes en archivos `.env` de producción.
- Amazon RDS (PostgreSQL) como base de datos gestionada.
- Amazon ElastiCache (Redis) para caché, cuotas y colas.
- Amazon S3 para almacenamiento de adjuntos y archivos futuros.
- Amazon ECS/Fargate (o EC2 si se requiere control total) para los contenedores `web`, `api` y `worker`.
- Amazon CloudWatch como base de observabilidad, complementado con OpenTelemetry para trazas.

### 3.3 Estructura del monorepo

```text
/apps
  /web-superadmin
  /api
  /worker
/packages
  /ui
  /design-tokens
  /contracts
  /config-eslint
  /config-typescript
  /testing
  /observability
/infrastructure
  /docker
  /migrations
  /deployment
/docs
  /adr
  /api
  /product
```

---

## 4. Modelo multiempresa

La plataforma debe diseñarse como multi-tenant desde el inicio.

- `platform`: el ecosistema completo administrado por el Superadmin.
- `organization`: una empresa cliente que compra una licencia.
- `workspace`: unidad opcional dentro de una organización. En el futuro podría representar una sucursal, negocio o RUC.
- `user`: identidad humana.
- `membership`: relación entre usuario, organización y rol.
- `subscription`: relación comercial con un plan.
- `license`: credencial lógica que habilita el producto y sus módulos.

Toda tabla perteneciente a un cliente deberá incluir `organization_id`. La API no aceptará ese identificador como prueba de autorización. Lo obtendrá del contexto autenticado y aplicará filtros obligatorios en repositorios o políticas de acceso.

Para el MVP se recomienda base compartida y esquema compartido con aislamiento por `organization_id`. Si luego existen clientes con exigencias especiales, se puede habilitar aislamiento por base de datos como modalidad empresarial.

---

## 5. Roles y permisos

### Roles iniciales

- **Platform Owner:** control absoluto, configuración crítica y gestión de otros administradores.
- **Superadmin:** clientes, usuarios, licencias, planes, métricas y operaciones.
- **Finance Admin:** ingresos, gastos, categorías, comprobantes internos y reportes financieros.
- **Support Agent:** lectura de clientes y licencias, notas de soporte y acciones limitadas.
- **Auditor:** acceso de solo lectura a reportes y bitácoras.
- **Client Owner:** rol futuro dentro de la plataforma del cliente.

### Capacidades

La autorización debe ser por capacidades, por ejemplo:

```text
organizations.read
organizations.create
organizations.update
users.invite
users.reset_credentials
plans.read
plans.manage
licenses.read
licenses.issue
licenses.renew
licenses.suspend
licenses.revoke
usage.read
finance.read
finance.write
audit.read
platform.settings.manage
```

> **Nota de implementación (Fase 2):** la lista original era "por ejemplo", no exhaustiva. Al construir el módulo de licencias (SS6.5) se agregaron `plans.read`, `plans.manage` y `licenses.read`, siguiendo la misma convención `<recurso>.<verbo>` ya usada para el resto.

No se deben codificar permisos solo mediante condiciones como `role === 'admin'`. Los roles agrupan capacidades, y las políticas verifican capacidades.

---

## 6. Módulos funcionales del Superadmin

### 6.1 Autenticación y seguridad

- Inicio de sesión por correo o nombre de usuario.
- Contraseña almacenada con Argon2id.
- MFA obligatorio para Platform Owner y Superadmin.
- Recuperación de cuenta mediante enlace de un solo uso y expiración corta.
- Sesiones visibles y revocables.
- Bloqueo progresivo y rate limiting.
- Historial de accesos y alertas por actividad inusual.
- Invitaciones con token de un solo uso. Se debe evitar enviar contraseñas permanentes por correo.
- Cambio obligatorio de contraseña en el primer acceso si se usa una clave temporal.
- Sesiones basadas en access token JWT de vida corta (10-15 min) + refresh token opaco, revocable individualmente. Esto sostiene "sesiones visibles y revocables" sin depender de listas de revocación de JWT.
  > **Nota de implementación (Fase 1):** el refresh token se guarda hasheado (SHA-256) en una tabla `sessions` de PostgreSQL, no en Redis como se planteaba originalmente aquí. Motivo: para el volumen del MVP no hay necesidad de la velocidad de Redis en esta ruta, y mantener la sesión en la misma base transaccional que el usuario simplifica la revocación atómica (p. ej. al suspender una cuenta) sin coordinar dos almacenes. Redis queda reservado para caché, cuotas y colas, como ya dice la sección de infraestructura. Si el volumen de sesiones concurrentes lo justifica más adelante, migrar a Redis es un cambio localizado a `AuthService`.
- MFA mediante TOTP (RFC 6238, compatible con apps como Google Authenticator/Authy) con códigos de respaldo de un solo uso. WebAuthn/passkeys queda como mejora futura (P2), no bloqueante para el MVP.

### 6.2 Organizaciones y clientes

- Alta de empresa: razón social, nombre comercial, RUC opcional en esta fase, correo, teléfono, dirección y estado.
- Contactos comerciales y técnicos.
- Etiquetas y notas internas.
- Historial de cambios.
- Estado: prospecto, prueba, activo, moroso, suspendido o cerrado.
- Vista 360 con licencia, usuarios, consumo, pagos, incidencias y actividad.

### 6.3 Usuarios

- Crear o invitar usuario.
- Asociar usuarios con una organización.
- Asignar roles y controlar estado.
- Suspender, desbloquear o revocar sesiones.
- Reiniciar credenciales con flujo seguro.
- Ver último acceso, IP truncada o protegida, dispositivo y actividad relevante.

### 6.4 Planes

Cada plan incluirá:

- Nombre y código estable.
- Precio, moneda y periodicidad.
- Días de prueba.
- Número máximo de usuarios, sucursales, productos y almacenes futuros.
- Límite mensual de solicitudes API.
- Límite de almacenamiento.
- Módulos o feature flags habilitados.
- Política de exceso: bloquear, degradar, alertar o cobrar adicionalmente.
- Estado y versionado del plan.

Una licencia debe guardar una instantánea de sus condiciones. Así, una modificación posterior del plan no altera silenciosamente contratos existentes.

### 6.5 Licencias y suscripciones

- Crear licencia con identificador público no secuencial.
- Definir inicio, vencimiento, periodo de gracia y renovación.
- Estados: `draft`, `trial`, `active`, `past_due`, `grace_period`, `suspended`, `expired`, `revoked`.
- Renovar, extender, suspender, reactivar o revocar.
- Mantener historial de transiciones con actor, motivo y fecha.
- Aplicar feature flags y límites.
- Mostrar días restantes y porcentaje consumido.
- Permitir una licencia de prueba y promociones.
- Preparar webhooks firmados para notificar cambios a otros módulos.

### 6.6 Medición de consumo y tráfico

No se debe guardar solamente un contador total. Se registrarán eventos de uso y agregados por hora/día/mes.

Métricas propuestas:

- Solicitudes API totales y por endpoint lógico.
- Errores 4xx y 5xx.
- Latencia p50, p95 y p99.
- Usuarios activos diarios y mensuales.
- Sesiones iniciadas.
- Almacenamiento consumido.
- Operaciones relevantes realizadas.
- Trabajos de cola completados o fallidos.
- Consumo por módulo.
- En el futuro: documentos enviados a SUNAT, CDR procesadas, productos, movimientos y comprobantes.

El middleware de medición emitirá eventos asíncronos. Un worker los agregará para no aumentar la latencia de cada solicitud.

### 6.7 Finanzas internas del proyecto

Este módulo registra las finanzas de la empresa propietaria del SaaS, no la contabilidad tributaria completa de los clientes.

- Ingresos por venta, renovación, implementación y soporte.
- Gastos fijos y variables.
- Categorías y centros de costo.
- Proveedor o contraparte.
- Moneda PEN o USD y tipo de cambio registrado.
- Método de pago.
- Fecha de emisión, vencimiento y pago.
- Estado pendiente, parcial, pagado, vencido o anulado.
- Adjuntos de sustento.
- Ingresos recurrentes mensuales y anuales.
- Costos de infraestructura por cliente cuando sea posible.
- Margen bruto estimado.
- Flujo de caja por mes.
- Presupuesto frente a ejecución.

Los movimientos financieros no deben borrarse físicamente. Se anulan o revierten, conservando la trazabilidad.

### 6.8 Alertas y notificaciones

- Licencia por vencer en 30, 15, 7, 3 y 1 día.
- Licencia vencida o en periodo de gracia.
- Consumo al 70 %, 85 %, 95 % y 100 %.
- Incremento de errores.
- Cola detenida o trabajo fallido repetidamente.
- Pago pendiente o vencido.
- Inicio de sesión administrativo inusual.

Canales iniciales: notificación interna y correo. WhatsApp u otros canales se evaluarán después.

### 6.9 Auditoría

Eventos mínimos:

- Inicio y cierre de sesión.
- Cambio de contraseña o MFA.
- Creación, modificación o suspensión de usuario.
- Creación y transición de licencia.
- Cambio de plan, límites o precio.
- Registro, modificación, anulación o reversión financiera.
- Exportaciones de datos.
- Cambio de configuración o feature flag.

Cada evento guardará actor, acción, recurso, identificador, fecha, IP protegida, user-agent, razón y diferencias antes/después con campos sensibles redactados.

La inmutabilidad no debe depender solo de la capa de aplicación. La tabla `audit_logs` se define en PostgreSQL sin permisos de `UPDATE`/`DELETE` para el rol de aplicación (solo `INSERT`), y cada fila incluye un hash encadenado con la fila anterior para detectar alteraciones directas en base de datos.

---

## 7. Diseño de interfaz

La implementación seguirá la referencia de `DESIGN.md`: fondo blanco, tarjetas definidas por borde `#e5e5e5`, densidad compacta, tipografía Inter, titulares Satoshi o sustituto, radios controlados y un solo acento azul. Se evitarán sombras pesadas y colores decorativos excesivos. 

### Navegación propuesta

```text
Resumen
Clientes
Usuarios
Licencias
Planes
Consumo
Finanzas
Alertas
Auditoría
Salud del sistema
Configuración
```

### Pantallas del MVP

1. **Login:** acceso, MFA y recuperación.
2. **Dashboard:** MRR, licencias activas, próximas a vencer, consumo, errores, ingresos y gastos.
3. **Clientes:** tabla, filtros, alta y ficha 360.
4. **Usuarios:** listado, invitación, roles, bloqueo y sesiones.
5. **Licencias:** tabla, calendario de vencimientos, alta, renovación, suspensión y detalle.
6. **Planes:** configuración y versionado básico.
7. **Consumo:** series temporales, cuotas y desglose por cliente.
8. **Finanzas:** movimientos, categorías, adjuntos, flujo mensual y margen estimado.
9. **Alertas:** bandeja, severidad, estado y resolución.
10. **Auditoría:** búsqueda por actor, recurso, acción y fecha.
11. **Salud:** API, worker, base de datos, Redis, colas y errores recientes.
12. **Configuración:** seguridad, notificaciones, monedas y parámetros globales.

### Componentes compartidos

- App shell con sidebar de aproximadamente 240 px.
- Data table con filtros persistentes.
- KPI card.
- Status badge.
- Usage progress.
- Date range picker.
- Money input.
- Confirm dialog con campo obligatorio de motivo para acciones destructivas.
- Empty state, skeleton, error state y retry.
- Command palette opcional.

---

## 8. Modelo de datos inicial

Entidades principales:

```text
platform_users
roles
permissions
role_permissions
user_roles
sessions
mfa_methods
organizations
organization_contacts
memberships
plans
plan_versions
plan_features
subscriptions
licenses
license_events
usage_events
usage_aggregates_hourly
usage_aggregates_daily
quota_snapshots
financial_transactions
financial_categories
cost_centers
attachments
alerts
notifications
webhook_endpoints
webhook_deliveries
audit_logs
feature_flags
system_health_snapshots
```

### Reglas críticas

- Identificadores UUID/ULID internos.
- Fechas almacenadas en UTC y mostradas en `America/Lima`.
- Dinero en unidades mínimas enteras, por ejemplo céntimos, nunca `float`.
- Moneda ISO 4217.
- Soft delete solo donde sea apropiado.
- Restricciones e índices definidos en base de datos, no solo en aplicación.
- Idempotency key para operaciones sensibles.
- Optimistic locking para renovaciones y movimientos financieros.
- `audit_logs` es append-only a nivel de base de datos (sin `UPDATE`/`DELETE` para el rol de aplicación) con hash encadenado entre filas.

---

## 9. API del MVP

Base: `/api/v1`.

```text
POST   /auth/login
POST   /auth/mfa/verify
POST   /auth/refresh
POST   /auth/logout
POST   /auth/password/forgot
POST   /auth/password/reset

GET    /organizations
POST   /organizations
GET    /organizations/:id
PATCH  /organizations/:id
GET    /organizations/:id/overview

GET    /users
POST   /users/invitations
PATCH  /users/:id
POST   /users/:id/suspend
POST   /users/:id/revoke-sessions

GET    /plans
POST   /plans
POST   /plans/:id/versions

GET    /licenses
POST   /licenses
GET    /licenses/:id
POST   /licenses/:id/renew
POST   /licenses/:id/suspend
POST   /licenses/:id/reactivate
POST   /licenses/:id/revoke

GET    /usage/summary
GET    /usage/timeseries
GET    /usage/organizations/:organizationId

GET    /finance/transactions
POST   /finance/transactions
PATCH  /finance/transactions/:id
POST   /finance/transactions/:id/void
GET    /finance/dashboard

GET    /alerts
POST   /alerts/:id/acknowledge
POST   /alerts/:id/resolve

GET    /audit-logs
GET    /health
```

Todas las listas tendrán paginación, ordenamiento, filtros y límites máximos. Los comandos sensibles recibirán `Idempotency-Key` y motivo de operación.

---

## 10. Preparación para SUNAT

La integración futura debe quedar detrás de un puerto o contrato independiente:

```text
TaxAuthorityGateway
  validateTaxpayer()
  issueDocument()
  queryDocumentStatus()
  downloadReceipt()
  voidDocument()
  submitSummary()
```

Esto permitirá usar integración directa, un PSE/OSE o un proveedor privado sin acoplar el dominio de inventario a una implementación específica.

Consideraciones futuras:

- XML UBL, firma digital, certificados y CDR.
- Ambientes de prueba y producción completamente separados.
- Credenciales cifradas por empresa.
- Reintentos con backoff, idempotencia y cola de errores.
- Correlación entre venta, comprobante, XML, ticket y CDR.
- Conservación de documentos y trazabilidad.
- Catálogos y reglas versionadas, porque pueden cambiar.

SUNAT publica guías, estructuras y reglas de validación para comprobantes electrónicos; además, su consulta integrada usa credenciales de aplicación y generación de token. La implementación deberá basarse en la documentación oficial vigente al momento de construir el módulo, no en supuestos fijos. [Guías y manuales SUNAT](https://cpe.sunat.gob.pe/guias-y-manuales) y [Manual de consulta integrada](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2.pdf). 

---

## 11. Equipo de subagentes de desarrollo

Los subagentes serán roles especializados coordinados por un agente orquestador. No deberán editar simultáneamente el mismo archivo. Cada tarea tendrá propietario, alcance, entradas, salidas y criterios de aceptación.

### Agente 0: Orquestador técnico

**Misión:** convertir el backlog en tareas pequeñas, asignarlas, revisar dependencias, ejecutar gates y consolidar entregables.

**Entrega:** plan de iteración, matriz de dependencias, estado, riesgos y decisión final de integración.

### Agente 1: Arquitectura y dominio

**Misión:** definir módulos, límites, ADR, eventos, reglas de negocio y contratos.

**Subagentes:**

- Modelador multi-tenant.
- Diseñador de licenciamiento y cuotas.
- Diseñador del adaptador SUNAT futuro.

### Agente 2: Backend

**Misión:** desarrollar módulos NestJS, políticas, validaciones, repositorios y API.

**Subagentes:**

- Identidad y RBAC.
- Organizaciones y usuarios.
- Planes y licencias.
- Uso y cuotas.
- Finanzas.
- Alertas y auditoría.

### Agente 3: Datos

**Misión:** modelo PostgreSQL, Prisma, migraciones, índices, seeds y estrategia de respaldo.

### Agente 4: Frontend

**Misión:** React, rutas, pantallas, formularios, tablas, gráficos y estados de interfaz.

**Subagentes:**

- Design system.
- Dashboard y visualización.
- CRUD operativos.
- Accesibilidad y responsive.

### Agente 5: Seguridad

**Misión:** threat model, autenticación, MFA, secrets, rate limits, aislamiento multi-tenant y auditoría.

### Agente 6: QA

**Misión:** estrategia de pruebas, fixtures, contratos, integración, E2E, regresión y pruebas de permisos.

### Agente 7: DevOps y observabilidad

**Misión:** contenedores, CI/CD, entornos, telemetría, alertas, backup y runbooks.

### Agente 8: Producto y UX

**Misión:** historias de usuario, flujos, criterios de aceptación, microcopy y revisión contra el archivo de diseño.

### Agente 9: Revisor financiero y tributario

**Misión:** revisar terminología, flujos financieros internos y supuestos de SUNAT. Este agente genera observaciones, no reemplaza la validación profesional humana.

---

## 12. Protocolo de trabajo de agentes

### Flujo obligatorio

1. **Plan:** analiza historia, dependencias y riesgos.
2. **Contrato:** define interfaces, esquemas y criterios de aceptación.
3. **Implementación:** cambia solo archivos asignados.
4. **Autorrevisión:** ejecuta lint, tipos y pruebas del alcance.
5. **Revisión adversarial:** otro agente intenta hallar errores y violaciones de seguridad.
6. **Corrección:** se atienden hallazgos.
7. **Gate:** QA y Orquestador autorizan integración.
8. **Documentación:** ADR, API y changelog actualizados.

Este flujo de 8 pasos aplica a nivel de historia o feature del backlog, no a cada commit o cambio trivial dentro de una tarea ya aprobada. Aplicarlo literalmente a cada commit generaría sobrecarga de proceso incompatible con el ritmo de un MVP.

### Formato de entrega de un agente

```markdown
## Resultado
- Objetivo cumplido:
- Archivos modificados:
- Decisiones tomadas:
- Pruebas ejecutadas:
- Resultado de pruebas:
- Riesgos pendientes:
- Migraciones o variables nuevas:
- Evidencia de criterios de aceptación:
```

---

## 13. Prompts base y few-shot prompting

### Prompt de sistema para cada subagente

```text
Eres el subagente {ROL} del proyecto Superadmin SaaS Perú.
Trabaja únicamente dentro de {ALCANCE}.
Antes de modificar código, revisa los contratos, ADR y criterios de aceptación.
No inventes endpoints, tablas ni reglas externas al contrato aprobado.
Mantén aislamiento multi-tenant, validación de entrada, auditoría y mínimos privilegios.
No imprimas secretos ni datos sensibles.
Ejecuta las pruebas correspondientes y entrega evidencia.
Si encuentras una contradicción, detén esa parte y registra un bloqueo concreto.
Devuelve el resultado usando el formato estándar del proyecto.
```

### Ejemplo correcto de tarea

```text
Implementa POST /api/v1/licenses/:id/renew.
Entrada: fecha de término nueva, motivo e Idempotency-Key.
Reglas: solo licenses.renew; la fecha debe ser posterior a la actual; no renovar revocadas;
crear license_event; escribir audit_log; evitar doble renovación con la misma clave.
Pruebas: éxito, permiso denegado, licencia revocada, fecha inválida e idempotencia.
No modifiques frontend ni esquema fuera de la migración aprobada.
```

### Ejemplo incorrecto que debe rechazarse

```text
Haz todo el módulo de licencias y mejora lo que creas necesario.
```

Motivo: no define contrato, límites, permisos, casos de error ni pruebas.

### Shot prompting recomendado

Para historias críticas, proporcionar al agente:

1. Un ejemplo de endpoint correcto.
2. Un ejemplo de respuesta de error normalizada.
3. Un ejemplo de prueba de aislamiento multi-tenant.
4. Un ejemplo de evento de auditoría con campos sensibles redactados.

Esto reduce variaciones y ayuda a que distintos subagentes mantengan el mismo estándar.

---

## 14. Hooks y gates automatizados

### Pre-commit

- Formato de archivos modificados.
- ESLint.
- Detección de secretos.
- Validación de nombres de migración.

### Commit-msg

- Conventional Commits.
- Referencia obligatoria a historia o incidencia.

### Pre-push

- Typecheck completo.
- Pruebas unitarias afectadas.
- Verificación de cobertura mínima en módulos críticos.

### Pull request

- Build reproducible.
- Tests unitarios e integración.
- Tests E2E críticos.
- Análisis de dependencias vulnerables.
- Escaneo de secretos y contenedores.
- Validación de migraciones hacia adelante.
- Comparación de contrato OpenAPI.
- Revisión visual de pantallas modificadas.
- Checklist multi-tenant y RBAC.

### Post-deploy

- Smoke tests.
- Verificación de migración.
- Health checks de API, worker, PostgreSQL y Redis.
- Validación de login y consulta de dashboard.
- Alerta y rollback si se supera umbral de errores.

### Hooks funcionales internos

- `license.created`: programar alertas y registrar auditoría.
- `license.expiring`: notificar.
- `license.suspended`: revocar acceso aplicable y emitir webhook.
- `usage.threshold_reached`: crear alerta y aplicar política.
- `finance.transaction_recorded`: recalcular agregados.
- `user.invited`: enviar invitación.
- `security.suspicious_login`: alertar y elevar verificación.

Para trabajos asíncronos se recomienda BullMQ con reintentos, backoff e idempotencia. NestJS dispone de integración `@nestjs/bullmq`, y BullMQ puede producir telemetría mediante OpenTelemetry. 

---

## 15. Pruebas y calidad

### Pirámide de pruebas

- Unitarias: reglas de licencias, cuotas, dinero, permisos y transiciones.
- Integración: repositorios, API, Redis, colas y auditoría.
- Contrato: OpenAPI y eventos.
- E2E: login, crear cliente, invitar usuario, emitir licencia, renovar, suspender y registrar movimiento financiero.
- Seguridad: IDOR, escalamiento de privilegios, brute force, sesiones, inyección y aislamiento tenant.
- Rendimiento: objetivos concretos a validar:
  - Dashboard: p95 de carga menor a 800 ms.
  - Endpoints de listado (API REST): p95 menor a 300 ms con paginación estándar.
  - Ingestión de eventos de uso: procesamiento asíncrono sin impacto medible (mayor a 50 ms) en la latencia de la solicitud que los origina.

### Casos críticos

- Un administrador de cliente nunca accede a otra organización.
- Una renovación duplicada no cobra ni extiende dos veces.
- Una licencia vencida cambia su capacidad de acceso según política.
- Un gasto anulado conserva su historia.
- Las acciones sensibles siempre producen auditoría.
- La caída del worker no pierde eventos y se recupera.
- Los errores no exponen stack, secretos ni PII.

### Definición de terminado

- Criterios de aceptación aprobados.
- Código revisado por otro agente.
- Lint, tipos, pruebas y build en verde.
- Permisos y aislamiento comprobados.
- Telemetría y logs añadidos.
- Documentación actualizada.
- Migración reversible o procedimiento de roll-forward documentado.
- Sin secretos o datos reales en fixtures.

---

## 16. Roadmap de implementación

### Fase 0: Descubrimiento y base, 1 semana

- Historias, glosario y métricas.
- ADR del monolito modular y multi-tenancy.
- Monorepo, Docker, CI y entornos.
- Tokens de diseño y app shell.
- Threat model inicial.

### Fase 1: Identidad y organizaciones, 2 semanas

- Login, MFA, recuperación y sesiones.
- RBAC por capacidades.
- Clientes, organizaciones, contactos y usuarios.
- Auditoría base.

### Fase 2: Planes y licencias, 2 semanas

- Planes versionados.
- Emisión y ciclo de vida de licencias.
- Cuotas y feature flags.
- Alertas de vencimiento.

### Fase 3: Medición y dashboard, 2 semanas

- Ingestión de eventos.
- Agregados de consumo.
- Dashboard operativo.
- Salud de sistema y colas.

### Fase 4: Finanzas internas, 2 semanas

- Ingresos, gastos, categorías y centros de costo.
- Adjuntos.
- MRR, margen y flujo mensual.
- Exportación CSV controlada.

### Fase 5: Endurecimiento y piloto, 2 semanas

- Pruebas E2E y seguridad.
- Rendimiento, backup y restauración.
- Runbooks, alertas y observabilidad.
- Piloto con datos ficticios y luego clientes seleccionados.

**Estimación total inicial:** 9 a 11 semanas para un equipo pequeño con dedicación constante. La estimación debe recalibrarse después de convertir cada módulo en historias y medir la velocidad real. Dado el alcance completo (auth + MFA + RBAC + licencias + cuotas + dashboard + finanzas + auditoría + observabilidad), este rango es optimista y debe tratarse como hipótesis de partida, no como fecha comprometida.

---

## 17. Backlog inicial priorizado

### P0

- Autenticación, MFA y sesiones.
- RBAC y auditoría.
- Organizaciones y usuarios.
- Planes y licencias.
- Renovación, suspensión y vencimiento.
- Dashboard mínimo.
- Ingresos y gastos.
- Backups y health checks.

### P1

- Medición avanzada y percentiles.
- Alertas configurables.
- Costos por cliente.
- Adjuntos y exportaciones.
- Webhooks firmados.
- Feature flags por licencia.

### P2

- Automatización de cobros.
- Portal de soporte.
- Aplicación móvil.
- Analítica predictiva.
- Separación de servicios si las métricas lo justifican.

---

## 18. Riesgos y mitigaciones

- **Alcance excesivo:** proteger el MVP y dejar inventario/SUNAT fuera de esta etapa.
- **Complejidad multi-tenant:** pruebas automáticas de aislamiento en cada endpoint.
- **Licenciamiento inconsistente:** máquina de estados y operaciones idempotentes.
- **Métricas costosas:** eventos asíncronos, agregados y políticas de retención.
- **Errores financieros:** valores enteros, doble control y reversión auditable.
- **Reglas SUNAT cambiantes:** adaptador desacoplado y catálogos versionados.
- **Fuga de credenciales:** secret manager, cifrado, rotación y redacción de logs.
- **Dependencia de IA:** ningún cambio crítico se integra sin pruebas y revisión adversarial.
- **Microservicios prematuros:** iniciar modular y separar solo con evidencia operativa.
- **Cronograma optimista:** medir velocidad real desde la Fase 0 y ajustar el roadmap; comunicar el rango de 9-11 semanas como estimación preliminar, no como fecha comprometida.

---

## 19. Métricas de éxito

- Tiempo medio para crear cliente y licencia menor a 5 minutos.
- 100 % de acciones críticas con auditoría.
- 0 accesos cruzados entre organizaciones en pruebas.
- Renovaciones duplicadas efectivas igual a 0.
- Dashboard operativo con retraso menor a 5 minutos.
- Alertas de vencimiento entregadas según calendario.
- Disponibilidad objetivo inicial de 99.5 % durante piloto.
- Backups automáticos diarios (AWS RDS snapshots + point-in-time recovery), con RPO objetivo ≤ 24 horas y RTO objetivo ≤ 4 horas durante el piloto, y al menos un ensayo de restauración antes del piloto con clientes reales.
- Tasa de errores de la API visible y accionable.

---

## 20. Primer sprint ejecutable

### Historias

1. Inicializar monorepo, Docker Compose y pipeline.
2. Implementar tokens visuales y app shell.
3. Crear esquema base de usuarios, roles, permisos y auditoría.
4. Implementar login, refresh, logout y MFA.
5. Crear CRUD de organizaciones con filtros.
6. Crear invitación de usuario y asignación de membership.
7. Añadir health checks, logs estructurados y trazas.
8. Crear suite E2E del flujo login → organización → invitación.

### Resultado esperado

Al finalizar el sprint debe existir una base desplegable en un entorno de desarrollo, con acceso administrativo seguro, creación de organizaciones, invitación de usuarios, auditoría y una interfaz alineada con el diseño proporcionado.

---

## 21. Criterio para comenzar el módulo de inventario

El desarrollo del inventario debe comenzar solo cuando:

- El ciclo de licencias funciona end-to-end.
- Las cuotas pueden medirse y aplicarse.
- El aislamiento multi-tenant está probado.
- Auditoría y observabilidad están operativas.
- Backup y restauración fueron ensayados.
- Existe un contrato estable para organizaciones, usuarios y feature flags.

Después se podrá diseñar un núcleo de inventario adaptable por rubro mediante configuraciones, unidades, atributos dinámicos, lotes, series, vencimientos, almacenes y reglas específicas, evitando crear un modelo distinto para cada negocio.

---

## 22. Fuentes técnicas consultadas

- SUNAT, guías y manuales de comprobantes electrónicos: https://cpe.sunat.gob.pe/guias-y-manuales
- SUNAT, manual de consulta integrada por servicio web: https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual-de-Consulta-Integrada-de-Comprobante-de-Pago-por-ServicioWEB_v2.pdf
- NestJS, gestión de colas: https://github.com/nestjs/docs.nestjs.com/blob/master/content/techniques/queues.md
- BullMQ, integración con NestJS: https://docs.bullmq.io/guide/nestjs/
- BullMQ, telemetría con OpenTelemetry: https://docs.bullmq.io/guide/telemetry/getting-started
- TanStack Query para React: https://tanstack.com/query/latest/docs/framework/react

---

## Conclusión

La primera entrega debe ser un **centro de control SaaS**, no una versión incompleta del sistema de inventario. La arquitectura propuesta prioriza seguridad, multi-tenancy, licenciamiento, medición, finanzas internas y auditoría. Con esta base estable, el inventario y la integración con SUNAT podrán añadirse como dominios desacoplados sin reconstruir autenticación, clientes, cuotas, observabilidad o administración comercial.
