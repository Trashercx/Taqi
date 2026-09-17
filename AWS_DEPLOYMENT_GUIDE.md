# Guía de despliegue en AWS (consola, paso a paso)

Esta guía es para configurar la nube **a mano, desde la consola web de AWS**,
con el objetivo de aprender cómo funciona cada pieza antes de automatizarlo
con Terraform y el CLI (que es el paso natural una vez que esto ya tenga
sentido para ti). Sigue el orden: cada paso depende de recursos creados en
el paso anterior.

Todo el código que esta guía usa ya está en el repo:

| Qué | Dónde |
|---|---|
| Imágenes de producción (Dockerfiles multi-stage) | `infrastructure/docker/*.Dockerfile.prod` |
| Definiciones de tarea de ECS (JSON, listas para `aws ecs register-task-definition`) | `infrastructure/aws/task-definitions/` |
| Políticas de IAM (JSON) | `infrastructure/aws/iam/` |
| Pipeline de CI/CD (build + push a ECR) | `.github/workflows/deploy.yml` |

Arquitectura objetivo (ya decidida en [`PLANTEAMIENTO_SUPERADMIN.md` §3.2](./PLANTEAMIENTO_SUPERADMIN.md)):

```text
                          Internet
                             │
                    ┌────────▼────────┐
                    │  Application     │
                    │  Load Balancer   │  (HTTPS, opcional con dominio propio)
                    └───┬──────────┬───┘
                        │          │
                ┌───────▼──┐   ┌───▼────────┐
                │  ECS      │   │  ECS        │
                │  api      │   │  web        │  (o S3+CloudFront, ver Paso 9)
                │ (Fargate) │   │ (Fargate)   │
                └─────┬─────┘   └─────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
  ┌─────▼─────┐ ┌─────▼──────┐ ┌────▼─────┐
  │    RDS     │ │ElastiCache │ │   ECS     │
  │ PostgreSQL │ │   Redis    │ │  worker   │
  └────────────┘ └────────────┘ └───────────┘

  Secrets Manager: credenciales de BD, JWT_ACCESS_SECRET, MFA_ENCRYPTION_KEY
  CloudWatch: logs de los 3 servicios + métricas + alarmas
  ECR: registro de las 3 imágenes Docker
  S3: adjuntos de sustento (financieros) — se agrega cuando ese módulo lo necesite
```

---

## Antes de empezar

### Costo estimado

Con los tamaños mínimos recomendados en esta guía (sin Multi-AZ, sin NAT
Gateway — ver el porqué en el Paso 2):

| Recurso | Costo aproximado/mes |
|---|---|
| RDS PostgreSQL `db.t4g.micro` (single-AZ, 20 GB) | ~US$ 13 |
| ElastiCache Redis `cache.t4g.micro` | ~US$ 11 |
| ECS Fargate (api + worker, 0.25 vCPU / 0.5 GB c/u, 24/7) | ~US$ 15–20 |
| Application Load Balancer | ~US$ 16 + tráfico |
| ECR, Secrets Manager, CloudWatch Logs | ~US$ 2–5 |
| **Total aproximado** | **~US$ 60–75/mes** |

Si tu cuenta es nueva, el [Free Tier de AWS](https://aws.amazon.com/free/)
cubre buena parte de esto los primeros 12 meses (RDS, algo de Fargate).
Aun así: **configura una alarma de facturación antes de crear nada más.**

1. Entra a **Billing and Cost Management** → **Budgets** → **Create budget**.
2. Elige "Zero spend budget" si quieres una alerta ante el primer cargo, o un
   monto fijo (por ejemplo US$ 20) para este proyecto.
3. Agrega tu correo como destinatario de la alerta.

### Seguridad de la cuenta (no te lo saltes)

1. **Nunca uses el usuario root para el día a día.** Actívale MFA (IAM →
   "Security credentials" del usuario root) y guárdalo aparte.
2. Crea un usuario IAM para ti mismo con permisos de administrador
   (`AdministratorAccess`) y usa ese para todo lo que sigue.
3. Instala el [AWS CLI](https://aws.amazon.com/cli/) aunque hoy lo uses poco
   — lo necesitarás para registrar las task definitions (Paso 9) y, más
   adelante, para Terraform.

---

## Paso 1 — IAM: usuario de despliegue para GitHub Actions

Este es distinto del usuario admin de arriba: es una identidad de máquina,
con el mínimo permiso posible, que solo puede publicar imágenes a los 3
repositorios de este proyecto.

1. **IAM** → **Users** → **Create user** → nombre `superadmin-ci-deploy`.
   No le des acceso a la consola (solo "Access key - Programmatic access").
2. **IAM** → **Policies** → **Create policy** → pestaña **JSON** → pega el
   contenido de `infrastructure/aws/iam/github-actions-ecr-push-policy.json`,
   reemplazando `<AWS_REGION>` y `<AWS_ACCOUNT_ID>` (lo ves arriba a la
   derecha de la consola, o con `aws sts get-caller-identity`).
   Nómbrala `superadmin-ci-ecr-push`.
3. Adjunta esa política al usuario `superadmin-ci-deploy`.
4. **Security credentials** del usuario → **Create access key** → caso de
   uso "Third-party service". Guarda el `Access Key ID` y el `Secret Access
   Key`: los vas a necesitar en el Paso 13 (no se pueden volver a ver).

> Esto usa credenciales de larga duración porque es lo más simple para
> aprender. La alternativa correcta a mediano plazo es OIDC (GitHub Actions
> asume un rol de IAM sin guardar ninguna clave) — vale la pena investigarlo
> cuando te sientas cómodo con lo básico.

---

## Paso 2 — Red (VPC)

Para este proyecto vas a usar la **VPC default** de tu cuenta (ya existe,
tiene subredes públicas en cada zona de disponibilidad). Es la opción
correcta para aprender: una VPC custom con subredes privadas necesita un
**NAT Gateway** para que las tareas en esas subredes privadas alcancen
Internet (para hablar con ECR, por ejemplo), y un NAT Gateway cuesta
~US$ 32/mes **más** el tráfico que pase por él — antes de haber desplegado
nada.

El patrón que vas a usar en su lugar: las tareas de Fargate corren en las
subredes **públicas** de la VPC default con IP pública asignada (para poder
descargar su propia imagen de ECR), pero **no son alcanzables directamente
desde Internet**: el Security Group solo deja entrar tráfico desde el Load
Balancer. RDS y Redis, en esas mismas subredes, tienen "Publicly accessible"
en `No` y su Security Group solo acepta conexiones desde el Security Group
de las tareas. El efecto práctico de seguridad es equivalente a una subred
privada, sin pagar el NAT Gateway.

1. **VPC** → confirma que existe una VPC con el tag `default = true` y
   anota su `VPC ID` y los `Subnet ID` de al menos 2 zonas de disponibilidad
   distintas (Fargate y RDS Multi-AZ lo piden).
2. **EC2** → **Security Groups** → **Create security group**, crea estos 4:

   | Nombre | Entrada permitida | Para |
   |---|---|---|
   | `superadmin-alb-sg` | 80/443 desde `0.0.0.0/0` | El Load Balancer |
   | `superadmin-ecs-sg` | 3001 y 80 desde `superadmin-alb-sg` | Las tareas de api/web |
   | `superadmin-rds-sg` | 5432 desde `superadmin-ecs-sg` | RDS |
   | `superadmin-redis-sg` | 6379 desde `superadmin-ecs-sg` | ElastiCache |

   (Se referencian por Security Group, no por IP: en la consola, al agregar
   la regla de entrada, en "Source" eliges "Custom" y buscas el otro grupo
   por nombre.)

---

## Paso 3 — ECR: repositorios de imágenes

**ECR** → **Create repository**, uno por cada imagen, con estos nombres
exactos (el workflow de CI y las task definitions ya los usan así):

- `superadmin-api`
- `superadmin-worker`
- `superadmin-web`

Deja "Tag immutability" desactivado (por ahora reusamos el tag `latest`) y
"Scan on push" activado (es gratis y te avisa de vulnerabilidades conocidas
en las capas base de la imagen).

---

## Paso 4 — Secrets Manager

Crea estos 5 secretos como **"Other type of secret" → "Plaintext"** (no
"Key/value", para que el valor completo sea la connection string o el
valor tal cual). Usa exactamente estos nombres — las task definitions ya
los referencian:

| Nombre del secreto | Valor |
|---|---|
| `superadmin/database-url` | `postgresql://<usuario_admin_rds>:<password>@<endpoint_rds>:5432/superadmin` |
| `superadmin/app-database-url` | `postgresql://app_runtime:<password_app_runtime>@<endpoint_rds>:5432/superadmin` |
| `superadmin/redis-url` | `redis://<endpoint_elasticache>:6379` |
| `superadmin/jwt-access-secret` | 96+ caracteres hex aleatorios (`openssl rand -hex 48`) |
| `superadmin/mfa-encryption-key` | Exactamente 64 caracteres hex (`openssl rand -hex 32`) |

No vas a poder llenar `database-url`, `app-database-url` ni `redis-url` con
el valor final hasta después de los Pasos 5 y 6 (necesitas el endpoint que
AWS te asigna) — créalos ahora con un valor de relleno y edítalos después
("Secrets Manager" → el secreto → **Retrieve secret value** → **Edit**).

El rol `app_runtime` (con permisos restringidos, sin `UPDATE`/`DELETE` sobre
`audit_logs`) se crea con la migración
`apps/api/prisma/migrations/20260917120000_app_runtime_role/`. Esa
migración trae una contraseña de desarrollo hardcodeada
(`app_runtime_dev_password`) que **debes cambiar** antes de producción:
conéctate a la RDS ya creada (Paso 5) con un cliente de PostgreSQL y corre
`ALTER ROLE app_runtime WITH PASSWORD '<password_nueva>';`, y usa esa
password nueva en el secreto `app-database-url`.

---

## Paso 5 — RDS (PostgreSQL)

**RDS** → **Create database**:

- Engine: **PostgreSQL** (versión 16.x, la que usa `docker-compose.yml`).
- Templates: **Free tier** si tu cuenta califica, si no **Dev/Test**.
- DB instance identifier: `superadmin-db`.
- Master username: `superadmin` (coincide con lo que espera el resto del
  código, aunque técnicamente podrías usar otro).
- Master password: genera una fuerte y guárdala aparte (la vas a poner en
  el secreto `database-url` del Paso 4).
- Instance class: `db.t4g.micro`.
- Storage: 20 GB gp3 (alcanza de sobra para el MVP).
- **Multi-AZ: No** (duplica el costo; actívalo cuando el negocio lo
  justifique, no antes).
- VPC: la default. Subnet group: crea uno nuevo con las subredes públicas
  que anotaste en el Paso 2.
- **Public access: No.**
- VPC security group: **usa uno existente** → `superadmin-rds-sg`.
- Initial database name: `superadmin`.
- Backups: mantén el default de 7 días (cumple el RPO ≤24h de
  `PLANTEAMIENTO_SUPERADMIN.md` §19 con margen).

Cuando termine de aprovisionar (10–15 min), copia el **Endpoint** (algo como
`superadmin-db.xxxxx.<region>.rds.amazonaws.com`) y completa los secretos
`database-url`/`app-database-url` del Paso 4.

### Correr las migraciones y el rol `app_runtime`

Necesitas correr, en este orden, contra la RDS real:
1. Las migraciones de Prisma (`apps/api/prisma/migrations/`, incluye la que
   crea el rol `app_runtime`).
2. El seed inicial (crea los roles/permisos y el primer Platform Owner).

La forma más simple para una primera vez: desde tu máquina, si tu IP tiene
acceso (temporalmente puedes agregar tu IP al `superadmin-rds-sg` en el
puerto 5432, y quitarla después), corre:

```bash
cd apps/api
DATABASE_URL="postgresql://superadmin:<password>@<endpoint_rds>:5432/superadmin" \
  npx prisma migrate deploy
DATABASE_URL="postgresql://superadmin:<password>@<endpoint_rds>:5432/superadmin" \
  PLATFORM_OWNER_EMAIL="tu-correo@ejemplo.com" \
  pnpm run seed
```

La forma correcta para cuando ya tengas ECS funcionando (Paso 9): usar las
task definitions `superadmin-migrate` y `superadmin-seed` como tareas
"RunTask" one-off, sin exponer la base de datos a tu IP en ningún momento.

---

## Paso 6 — ElastiCache (Redis)

**ElastiCache** → **Redis caches** → **Create Redis cache**:

- Deployment option: **Design your own cache** → **Standalone** (sin
  réplicas: es cache/colas, no la fuente de verdad — si se reinicia no se
  pierde nada crítico).
- Name: `superadmin-redis`.
- Node type: `cache.t4g.micro`.
- Subnet group: crea uno con las mismas subredes públicas del Paso 2.
- VPC security group: `superadmin-redis-sg`.
- Encryption in transit: puedes dejarlo desactivado para simplificar el
  primer despliegue (actívalo después; si lo activas, la URL de conexión
  necesita `rediss://` en vez de `redis://`).

Copia el **Primary endpoint** y completa el secreto `redis-url` del Paso 4.

---

## Paso 7 — S3 (para cuando se implementen adjuntos)

Todavía no hace falta: los adjuntos de sustento en Finanzas (SS6.7) no
están implementados en el código (ver `README.md`, sección de roadmap).
Cuando llegue ese momento:

**S3** → **Create bucket** → `superadmin-saas-attachments-<algo-unico>` →
Block all public access: **sí, bloquear todo** (los adjuntos se sirven vía
URLs firmadas desde la API, nunca públicos) → Default encryption: SSE-S3.

---

## Paso 8 — CloudWatch (logs)

No necesitas crear los log groups a mano: las task definitions en
`infrastructure/aws/task-definitions/` ya tienen
`"awslogs-create-group": "true"`, así que ECS los crea solos la primera vez
que corre cada tarea (`/ecs/superadmin-api`, `/ecs/superadmin-worker`,
`/ecs/superadmin-migrate`, `/ecs/superadmin-seed`).

Cuando ya tengas el servicio corriendo, vale la pena crear un par de alarmas
básicas (**CloudWatch** → **Alarms** → **Create alarm**):

- CPU/memoria del servicio de ECS por encima del 85% sostenido.
- `HTTPCode_Target_5XX_Count` del Load Balancer > 0 en 5 minutos.

---

## Paso 9 — ECS: cluster, task definitions y servicios

### 9.1 Cluster

**ECS** → **Clusters** → **Create cluster** → nombre `superadmin-cluster`,
infraestructura **AWS Fargate**.

### 9.2 Roles de IAM que faltan

Las task definitions referencian dos roles que aún no existen:

1. `superadmin-ecs-execution-role` — el que usa **ECS mismo** para arrancar
   la tarea (descargar la imagen de ECR, leer los secrets, escribir logs).
   **IAM** → **Create role** → Trusted entity: pega
   `infrastructure/aws/iam/ecs-tasks-trust-policy.json` (o elige "AWS
   service" → "Elastic Container Service" → "Elastic Container Service
   Task" en el asistente, es equivalente). Adjunta como política inline el
   contenido de `infrastructure/aws/iam/ecs-execution-role-permissions-policy.json`
   (reemplaza los placeholders).
2. `superadmin-api-task-role` y `superadmin-worker-task-role` — los que usa
   **tu aplicación** en runtime para llamar APIs de AWS. Hoy el código no
   llama ninguna (no hay integración con S3 todavía), así que créalos solo
   con la trust policy (`ecs-tasks-trust-policy.json`) y sin políticas de
   permisos — son placeholders listos para cuando agregues S3 u otro
   servicio.

### 9.3 Registrar las task definitions

Con el AWS CLI ya instalado (Paso "Antes de empezar"), por cada archivo en
`infrastructure/aws/task-definitions/`:

```bash
# Reemplaza los placeholders <AWS_ACCOUNT_ID>, <AWS_REGION> y
# <TU_DOMINIO_FRONTEND> en una copia del archivo, luego:
aws ecs register-task-definition --cli-input-json file://api-task-definition.json
aws ecs register-task-definition --cli-input-json file://worker-task-definition.json
aws ecs register-task-definition --cli-input-json file://migrate-task-definition.json
aws ecs register-task-definition --cli-input-json file://seed-task-definition.json
```

(Si prefieres hacerlo desde la consola: **ECS** → **Task definitions** →
**Create new task definition** → **JSON** → pega el contenido ya con los
placeholders reemplazados.)

### 9.4 Correr las migraciones y el seed (antes de crear el servicio)

Estas dos son tareas de un solo uso ("RunTask"), no servicios permanentes:

```bash
aws ecs run-task \
  --cluster superadmin-cluster \
  --task-definition superadmin-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id-1>,<subnet-id-2>],securityGroups=[<sg-id-de-superadmin-ecs-sg>],assignPublicIp=ENABLED}"
```

Espera a que termine (**ECS** → tu cluster → pestaña **Tasks**, o
`aws ecs describe-tasks`) y revisa el log group `/ecs/superadmin-migrate`
en CloudWatch para confirmar que aplicó las migraciones sin errores.
Repite el mismo comando con `--task-definition superadmin-seed` — copia el
token de invitación que imprime en los logs, lo vas a necesitar para
activar tu primera cuenta de Platform Owner.

### 9.5 Load Balancer

**EC2** → **Load Balancers** → **Create load balancer** → **Application
Load Balancer**:

- Nombre: `superadmin-alb`. Scheme: **Internet-facing**.
- Subredes: las públicas del Paso 2. Security group: `superadmin-alb-sg`.
- Listener HTTP (80) → por ahora, redirige a un target group para la API
  (lo creas en el mismo asistente): `superadmin-api-tg`, puerto 3001,
  target type **IP** (obligatorio para Fargate), health check path
  `/api/v1/health`.
- Si vas a servir el frontend desde ECS también (ver 9.6), agrega un
  segundo listener/regla por path o por host header hacia
  `superadmin-web-tg` (puerto 80, health check `/health`).

Una vez que tengas un dominio (Paso 11) agrega un listener HTTPS (443) con
el certificado de ACM y redirige el 80 hacia el 443.

### 9.6 Servicios de ECS (api y worker)

**ECS** → tu cluster → **Services** → **Create**:

- **Servicio `superadmin-api`**: task definition `superadmin-api`, deseado
  1 (subir a 2 cuando quieras alta disponibilidad real), subredes
  públicas, security group `superadmin-ecs-sg`, **Public IP: ON** (la
  necesita para alcanzar ECR y Secrets Manager sin NAT Gateway — no la hace
  alcanzable directamente porque el security group solo acepta el ALB).
  Load balancer: adjunta el target group `superadmin-api-tg`.
- **Servicio `superadmin-worker`**: igual, sin load balancer (no expone
  puerto HTTP).

El frontend (`superadmin-web`) lo puedes desplegar como un tercer servicio
de ECS igual a los anteriores (con `superadmin-web-tg`), **o** con la
alternativa más barata de la sección siguiente.

---

## Alternativa más barata para el frontend: S3 + CloudFront

`apps/web-superadmin` compila a archivos estáticos (`dist/`) — no necesita
Node corriendo 24/7. Servirlo desde ECS es más simple de explicar (por eso
`web.Dockerfile.prod` existe y es la opción por defecto en esta guía), pero
subirlo a S3 + CloudFront es más barato (sin el costo fijo de una tarea de
Fargate corriendo todo el tiempo) y es exactamente lo que harías con
Terraform más adelante. Cuando quieras probarlo:

```bash
pnpm --filter @superadmin/web-superadmin build
aws s3 sync apps/web-superadmin/dist s3://<tu-bucket-frontend> --delete
```

con el bucket configurado para "Static website hosting" (o, mejor, privado
detrás de una distribución de CloudFront con Origin Access Control). Esto
queda fuera del alcance de esta primera guía por simplicidad.

---

## Paso 10 — Verificar que todo funciona

```bash
curl https://<dns-del-alb-o-tu-dominio>/api/v1/health
# {"status":"ok","timestamp":"..."}
```

Luego, con el token de invitación que imprimió la tarea de seed (Paso 9.4):

```bash
curl -X POST https://<dns-del-alb>/api/v1/users/invitations/<token>/accept \
  -H "Content-Type: application/json" \
  -d '{"password":"<una contraseña de 12+ caracteres>"}'
```

Como el Platform Owner requiere MFA, la respuesta trae `provisioningUri`:
agrégalo a una app de autenticación (o usa el flujo del frontend en
`/aceptar-invitacion/<token>`, que ya hace esto por ti) y ya puedes iniciar
sesión normalmente.

---

## Paso 11 — Dominio y HTTPS (opcional, recomendado antes de invitar usuarios reales)

1. Si no tienes dominio, cómpralo en **Route 53** → **Registered domains**
   (o usa uno que ya tengas, apuntando sus name servers a Route 53).
2. **Certificate Manager (ACM)** → **Request certificate** → dominio
   público, por ejemplo `api.tudominio.com` y `app.tudominio.com` →
   validación por DNS (ACM te da los registros CNAME; si el dominio ya
   está en Route 53, hay un botón "Create records in Route 53" que lo
   automatiza).
3. Agrega el listener HTTPS (443) al ALB del Paso 9.5 con este
   certificado, y en Route 53 crea un registro tipo **A (Alias)** apuntando
   `api.tudominio.com` al ALB.
4. Actualiza el secreto/variable `VITE_API_BASE_URL` (usada al construir la
   imagen del frontend, Paso 13) y el `CORS_ORIGIN` en
   `api-task-definition.json` para que apunten a los dominios reales, no a
   `localhost`.

---

## Paso 12 — Backups y ensayo de restauración

`PLANTEAMIENTO_SUPERADMIN.md` §19 pide un RPO ≤24h y un RTO ≤4h, con al
menos un ensayo de restauración antes de un piloto con clientes reales.
RDS ya te da backups automáticos diarios + point-in-time recovery con la
configuración por defecto del Paso 5. Antes de invitar al primer cliente
real:

1. **RDS** → tu instancia → **Actions** → **Restore to point in time** →
   restaura a una instancia nueva (`superadmin-db-restore-test`).
2. Confirma que los datos están ahí, mide cuánto tardó.
3. Borra la instancia de prueba (para no pagarla dos veces) y documenta el
   tiempo que tomó — eso es tu RTO medido, no estimado.

---

## Paso 13 — Conectar el pipeline de CI/CD

En GitHub: **Settings** → **Secrets and variables** → **Actions** del repo.

**Secrets** (pestaña "Secrets"):
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: los del usuario
  `superadmin-ci-deploy` (Paso 1).

**Variables** (pestaña "Variables"):
- `AWS_REGION`: la región que elegiste (por ejemplo `us-east-1`).
- `VITE_API_BASE_URL`: `https://api.tudominio.com/api/v1` (o la URL del
  ALB si todavía no tienes dominio).

Con eso, el workflow `.github/workflows/deploy.yml` ya puede correr
manualmente (pestaña **Actions** → **Deploy (build + push a ECR)** → **Run
workflow**): compila las 3 imágenes y las publica en ECR con el tag
`latest` + el SHA del commit.

**Importante:** este workflow solo publica imágenes nuevas en ECR. Todavía
NO actualiza el servicio de ECS para que las use — eso hoy es manual:

```bash
aws ecs update-service --cluster superadmin-cluster \
  --service superadmin-api --force-new-deployment
```

(fuerza a ECS a lanzar tareas nuevas, que descargan la imagen `latest` más
reciente de ECR). Automatizar este último paso dentro del mismo workflow es
una mejora natural una vez que te sientas cómodo con el flujo manual.

---

## Cómo apagar todo (para dejar de pagar)

Si en algún momento quieres pausar sin perder el trabajo hecho (o si esto
fue solo para aprender y quieres parar los cargos), en este orden:

1. **ECS** → servicios `superadmin-api` y `superadmin-worker` → **Update**
   → Desired tasks: **0** (no los borres todavía, solo apágalos).
2. **EC2** → Load Balancers → borra `superadmin-alb` (no se puede "pausar",
   solo borrar; puedes recrearlo después).
3. **ElastiCache** → borra `superadmin-redis` (no genera cargo si no
   existe).
4. **RDS** → tu instancia → **Actions** → **Stop temporarily** (se puede
   pausar hasta 7 días sin borrarla; después de eso AWS la reinicia sola).
   Si quieres pausarla más tiempo, toma un snapshot manual y borra la
   instancia.
5. Revisa **Billing** → **Bills** un día después para confirmar que los
   cargos recurrentes pararon.

Para borrar todo definitivamente, además de lo anterior: borra los
repositorios de ECR, el cluster de ECS, los secretos de Secrets Manager
(tienen un período de recuperación de 7-30 días por defecto, no se borran
al instante), y el certificado de ACM si no lo vas a reusar.

---

## Checklist final

- [ ] MFA activo en el usuario root, presupuesto de facturación configurado.
- [ ] Usuario `superadmin-ci-deploy` creado con la política de mínimo
      privilegio (Paso 1).
- [ ] Security Groups creados y referenciados entre sí, no por IP (Paso 2).
- [ ] 3 repositorios en ECR (Paso 3).
- [ ] 5 secretos en Secrets Manager con valores reales, no de relleno
      (Paso 4).
- [ ] RDS creada, `Publicly accessible: No`, contraseña de `app_runtime`
      rotada desde el valor de desarrollo (Paso 5).
- [ ] ElastiCache creado (Paso 6).
- [ ] Migraciones y seed corridos contra la RDS real (Paso 9.4).
- [ ] `GET /api/v1/health` responde `200` desde el ALB (Paso 10).
- [ ] Primer Platform Owner activado con MFA (Paso 10).
- [ ] Dominio + HTTPS si vas a invitar usuarios reales (Paso 11).
- [ ] Un ensayo de restauración de backup documentado (Paso 12).
- [ ] Pipeline de CI/CD conectado y probado una vez (Paso 13).
