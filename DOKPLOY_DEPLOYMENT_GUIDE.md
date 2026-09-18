# Despliegue en Dokploy

Esta guía despliega la demo con Docker Compose en un servidor administrado por
Dokploy. El despliegue AWS existente no se reemplaza: continúa usando
`infrastructure/aws/`, ECR y ECS cuando se necesite una plataforma administrada
con escalado horizontal.

## Qué se despliega

`infrastructure/docker/docker-compose.dokploy.yml` usa las imágenes de
producción del repositorio y levanta:

- `web`: SPA servida por nginx.
- `api`: API NestJS en el puerto interno 3001.
- `worker`: proceso separado para trabajos asíncronos.
- `postgres`: base de datos persistente.
- `redis`: Redis persistente para colas y estado auxiliar.
- `migrate`: tarea de una sola ejecución que aplica las migraciones antes de
  iniciar `api` y `worker`.

No se publican PostgreSQL ni Redis hacia Internet. Dokploy debe publicar
`web` y `api` mediante dominios separados o un dominio con rutas configuradas
en el panel.

## Configuración inicial

1. Instala Dokploy en un VPS con Docker y un dominio apuntando al servidor.
2. En Dokploy, crea una aplicación **Docker Compose** desde el repositorio
   GitHub y selecciona la rama que se desplegará.
3. Selecciona como archivo Compose:
   `infrastructure/docker/docker-compose.dokploy.yml`.
4. En la pestaña **Environment**, agrega las variables de
   `infrastructure/docker/.env.dokploy.example`.
5. Cambia todos los valores `replace-with-*` y usa secretos aleatorios reales.
6. Configura el dominio del servicio `web` en el puerto `80` y el de `api` en
   el puerto `3001`.
7. Ejecuta el primer despliegue y revisa los logs de `migrate`, `api` y
   `worker`.

Dokploy guarda las variables en el entorno de Compose, pero la definición debe
referenciarlas explícitamente con `${VARIABLE}`; por eso el Compose no usa
`env_file` y lista cada variable que necesita cada servicio.

Genera secretos localmente, sin subirlos al repositorio:

```bash
openssl rand -hex 48
openssl rand -hex 32
```

`DATABASE_URL` debe usar el usuario dueño de la base de datos para que
`migrate` pueda ejecutar Prisma. `APP_DATABASE_URL` debe usar el usuario
`app_runtime` creado por la migración correspondiente. Después de la primera
migración, cambia la contraseña de desarrollo de ese rol antes de usar datos
reales.

## Seed inicial

El seed no se ejecuta automáticamente en cada despliegue porque podría crear o
alterar datos administrativos. Tras el primer despliegue, ejecútalo una sola
vez desde la terminal del servidor o desde la función de comandos de Dokploy:

```bash
docker compose -f infrastructure/docker/docker-compose.dokploy.yml \
  run --rm api node dist/prisma/seed.js
```

Usa las mismas variables de entorno de la aplicación al ejecutar el comando.
Confirma en los logs el resultado y elimina cualquier token de invitación
temporal que no necesites conservar.

## Despliegues posteriores

Con la integración de GitHub habilitada, Dokploy puede desplegar
automáticamente los pushes a la rama configurada. Cada despliegue reconstruye
las imágenes y ejecuta `migrate` antes de iniciar la API y el worker.

La migración es un servicio one-shot intencionalmente: si falla, `api` y
`worker` no arrancan. No cambies esa dependencia por un script que ignore el
error de Prisma. Para cambios de esquema, revisa los logs de `migrate` antes
de reintentar el despliegue.

## Persistencia y límites de esta opción

Los named volumes `dokploy_postgres_data` y `dokploy_redis_data` sobreviven a
los redeploys. Configura backups periódicos en Dokploy o en un almacenamiento
externo; un volumen local no sustituye un backup. Para producción con usuarios
reales, mueve PostgreSQL a un servicio administrado y considera Redis
administrado antes de depender de un solo VPS.

Esta opción es adecuada para demo, desarrollo compartido y un MVP pequeño.
Cuando se necesiten varias réplicas, autoscaling, alta disponibilidad o
despliegues progresivos, conserva los Dockerfiles de producción y migra los
servicios a ECS/Fargate, manteniendo PostgreSQL en RDS y Redis en ElastiCache.
