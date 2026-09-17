import { Capability, CAPABILITIES } from './capability';

/**
 * Roles iniciales y sus capacidades (SS5). Usado por prisma/seed.ts y por
 * cualquier migracion futura que necesite resembrar el catalogo de roles.
 */
export const ROLE_SEEDS: {
  code: string;
  name: string;
  description: string;
  capabilities: Capability[];
}[] = [
  {
    code: 'platform_owner',
    name: 'Platform Owner',
    description:
      'Control absoluto, configuracion critica y gestion de otros administradores.',
    capabilities: [...CAPABILITIES],
  },
  {
    code: 'superadmin',
    name: 'Superadmin',
    description:
      'Clientes, usuarios, licencias, planes, metricas y operaciones.',
    capabilities: [
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
      'audit.read',
    ],
  },
  {
    code: 'finance_admin',
    name: 'Finance Admin',
    description:
      'Ingresos, gastos, categorias, comprobantes internos y reportes financieros.',
    capabilities: [
      'finance.read',
      'finance.write',
      'organizations.read',
      'plans.read',
      'licenses.read',
      'usage.read',
    ],
  },
  {
    code: 'support_agent',
    name: 'Support Agent',
    description:
      'Lectura de clientes y licencias, notas de soporte y acciones limitadas.',
    capabilities: ['organizations.read', 'licenses.read', 'plans.read'],
  },
  {
    code: 'auditor',
    name: 'Auditor',
    description: 'Acceso de solo lectura a reportes y bitacoras.',
    capabilities: [
      'audit.read',
      'organizations.read',
      'plans.read',
      'licenses.read',
      'usage.read',
      'finance.read',
    ],
  },
];
