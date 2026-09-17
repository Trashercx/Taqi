import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { ROLE_SEEDS } from '../src/rbac/roles.seed-data';
import { CAPABILITIES } from '../src/rbac/capability';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function main() {
  for (const code of CAPABILITIES) {
    await prisma.permission.upsert({ where: { code }, create: { code }, update: {} });
  }

  for (const roleSeed of ROLE_SEEDS) {
    const role = await prisma.role.upsert({
      where: { code: roleSeed.code },
      create: { code: roleSeed.code, name: roleSeed.name, description: roleSeed.description },
      update: { name: roleSeed.name, description: roleSeed.description },
    });

    const permissions = await prisma.permission.findMany({ where: { code: { in: roleSeed.capabilities } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
  }

  await prisma.auditChainLock.upsert({ where: { id: 1 }, create: { id: 1, tipHash: 'genesis' }, update: {} });

  // Catalogo inicial de finanzas (SS6.7): sin al menos una categoria por
  // tipo, POST /finance/transactions no tiene con que funcionar.
  const DEFAULT_CATEGORIES: { code: string; name: string; kind: 'income' | 'expense' }[] = [
    { code: 'venta_licencia', name: 'Venta de licencia', kind: 'income' },
    { code: 'renovacion', name: 'Renovacion', kind: 'income' },
    { code: 'implementacion', name: 'Implementacion', kind: 'income' },
    { code: 'soporte', name: 'Soporte', kind: 'income' },
    { code: 'infraestructura', name: 'Infraestructura (hosting, dominios, etc.)', kind: 'expense' },
    { code: 'personal', name: 'Personal', kind: 'expense' },
    { code: 'marketing', name: 'Marketing', kind: 'expense' },
    { code: 'otros_gastos', name: 'Otros gastos', kind: 'expense' },
  ];
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.financialCategory.upsert({
      where: { code: category.code },
      create: category,
      update: { name: category.name, kind: category.kind },
    });
  }

  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL ?? 'owner@example.com';
  const ownerName = process.env.PLATFORM_OWNER_NAME ?? 'Platform Owner';

  const existingOwner = await prisma.platformUser.findUnique({ where: { email: ownerEmail } });
  if (existingOwner) {
    console.log(`Platform Owner ya existe (${ownerEmail}), no se genera una nueva invitacion.`);
    return;
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'platform_owner' } });
  const invitationToken = generateOpaqueToken();

  const owner = await prisma.platformUser.create({
    data: {
      email: ownerEmail,
      fullName: ownerName,
      status: 'invited',
      invitationTokenHash: hashOpaqueToken(invitationToken),
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });
  await prisma.userRole.create({ data: { userId: owner.id, roleId: ownerRole.id } });

  console.log('');
  console.log('=== Platform Owner inicial creado ===');
  console.log(`Email: ${ownerEmail}`);
  console.log(`Token de invitacion (un solo uso, 7 dias): ${invitationToken}`);
  console.log('Acepta la invitacion con:');
  console.log(
    `POST /api/v1/users/invitations/${invitationToken}/accept  { "password": "<contraseña de al menos 12 caracteres>" }`,
  );
  console.log('======================================');
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
