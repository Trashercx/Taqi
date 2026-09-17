/**
 * Lista de capacidades aprobada en PLANTEAMIENTO_SUPERADMIN.md SS5 (la lista
 * base es "por ejemplo", no exhaustiva; las adiciones de cada fase se anotan
 * ahi mismo). No agregar codigos aqui sin actualizar ese contrato primero.
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
