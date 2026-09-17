/**
 * Lista de capacidades aprobada en PLANTEAMIENTO_SUPERADMIN.md SS5. No
 * agregar codigos aqui sin actualizar ese contrato primero.
 */
export const CAPABILITIES = [
  'organizations.read',
  'organizations.create',
  'organizations.update',
  'users.invite',
  'users.reset_credentials',
  'licenses.issue',
  'licenses.renew',
  'licenses.suspend',
  'licenses.revoke',
  'usage.read',
  'finance.read',
  'finance.write',
  'audit.read',
  'platform.settings.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
