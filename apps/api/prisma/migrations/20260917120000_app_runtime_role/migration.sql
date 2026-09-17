-- Rol de menor privilegio para el proceso de la API en tiempo de ejecucion.
-- Las migraciones (este archivo incluido) corren con el rol dueño de las
-- tablas via DATABASE_URL; la API corre con APP_DATABASE_URL apuntando a
-- app_runtime. Ver docs/adr y PLANTEAMIENTO_SUPERADMIN.md SS6.9/SS8.
--
-- La contraseña de abajo es un valor de desarrollo local fijo, pensado para
-- el docker-compose de este repo. En cualquier entorno que no sea un
-- laptop de desarrollo, el rol y su contraseña deben aprovisionarse con
-- infraestructura como codigo y un secreto de AWS Secrets Manager, nunca
-- con este archivo (que queda versionado en git).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN PASSWORD 'app_runtime_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE superadmin TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;

-- Acceso normal de lectura/escritura para el resto de tablas de la app,
-- incluidas las que se agreguen en migraciones futuras.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- Bitacora append-only: la aplicacion solo puede insertar y leer, nunca
-- alterar ni borrar un evento ya escrito.
REVOKE UPDATE, DELETE ON audit_logs FROM app_runtime;

-- audit_chain_lock es una fila unica (id=1) que AuditService actualiza para
-- encadenar el hash del siguiente evento: permite UPDATE, pero no
-- INSERT/DELETE (evita crear una segunda fila o borrar la existente).
REVOKE INSERT, DELETE ON audit_chain_lock FROM app_runtime;

-- Semilla de la fila unica del candado de auditoria.
INSERT INTO audit_chain_lock (id, tip_hash) VALUES (1, 'genesis')
ON CONFLICT (id) DO NOTHING;
