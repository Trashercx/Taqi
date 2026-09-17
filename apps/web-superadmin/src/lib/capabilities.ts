/**
 * Copia de apps/api/src/rbac/capability.ts para poder filtrar la UI
 * (mostrar/ocultar botones y secciones) sin depender de un paquete
 * compartido todavia. La autorizacion real siempre la hace la API; esto
 * solo evita mostrar acciones que el backend va a rechazar con 403.
 * Si el backend agrega una capacidad, hay que reflejarla aqui tambien.
 */
export const CAPABILITIES = [
  'organizations.read',
  'organizations.create',
  'organizations.update',
  'users.invite',
  'users.reset_credentials',
  'plans.read',
  'plans.manage',
  'licenses.read',
  'licenses.issue',
  'licenses.renew',
  'licenses.suspend',
  'licenses.revoke',
  'usage.read',
  'usage.write',
  'finance.read',
  'finance.write',
  'audit.read',
  'platform.settings.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
