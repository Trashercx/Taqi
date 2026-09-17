import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasher } from '../src/common/password-hasher.service';
import { encryptSecret } from '../src/common/crypto';

/**
 * Cubre el modulo de Fase 2 (SS6.4/SS6.5): crear un plan, agregarle una
 * version (instantania de precio/limites), emitir una licencia sobre una
 * organizacion, y recorrer la maquina de estados completa: trial -> (RBAC
 * negativo) -> suspender -> reactivar -> renovar -> revocar (terminal).
 * Corre contra Postgres real.
 *
 * El actor usa el rol 'superadmin' (el unico, junto a platform_owner, con
 * las capacidades licenses.issue/renew/suspend/revoke -- ver SS5). Como ese
 * rol exige MFA, el MFA se preinserta ya verificado directamente en la base
 * de datos (el enrolamiento por HTTP ya esta cubierto en
 * onboarding-flow.e2e-spec.ts, no hace falta repetirlo aqui).
 */
describe('E2E: planes y licencias (Fase 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const actorEmail = `e2e-licenses-actor-${suffix}@example.com`;
  const actorPassword = 'LicensesActor123!';
  const readonlyEmail = `e2e-licenses-readonly-${suffix}@example.com`;
  const readonlyPassword = 'LicensesReadonly123!';

  let actorAccessToken: string;
  let readonlyAccessToken: string;
  let organizationId: string;
  let planId: string;
  let planVersionId: string;
  let licenseId: string;
  let actorTotpSecret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHasher = app.get(PasswordHasher);

    const [superadminRole, supportRole] = await Promise.all([
      prisma.role.findUnique({ where: { code: 'superadmin' } }),
      prisma.role.findUnique({ where: { code: 'support_agent' } }),
    ]);
    if (!superadminRole || !supportRole) {
      throw new Error(
        "Faltan roles base. Corre 'pnpm --filter @superadmin/api seed' antes de los e2e.",
      );
    }

    const [actorHash, readonlyHash] = await Promise.all([
      passwordHasher.hash(actorPassword),
      passwordHasher.hash(readonlyPassword),
    ]);

    const actor = await prisma.platformUser.create({
      data: {
        email: actorEmail,
        fullName: 'E2E Licenses Actor',
        status: 'active',
        passwordHash: actorHash,
      },
    });
    await prisma.userRole.create({
      data: { userId: actor.id, roleId: superadminRole.id },
    });

    actorTotpSecret = authenticator.generateSecret();
    await prisma.mfaMethod.create({
      data: {
        userId: actor.id,
        type: 'totp',
        secretEncrypted: encryptSecret(actorTotpSecret),
        backupCodeHashes: [],
        verifiedAt: new Date(),
      },
    });

    const readonlyUser = await prisma.platformUser.create({
      data: {
        email: readonlyEmail,
        fullName: 'E2E Licenses Readonly',
        status: 'active',
        passwordHash: readonlyHash,
      },
    });
    await prisma.userRole.create({
      data: { userId: readonlyUser.id, roleId: supportRole.id },
    });

    const organization = await prisma.organization.create({
      data: { legalName: `E2E Licencias SAC ${suffix}`, status: 'prospecto' },
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('0. login de los actores (superadmin con MFA, support_agent sin MFA)', async () => {
    const actorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: actorEmail, password: actorPassword });
    expect(actorLogin.status).toBe(200);
    expect(actorLogin.body.mfaRequired).toBe(true);

    const code = authenticator.generate(actorTotpSecret);
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: actorLogin.body.challengeToken, code });
    expect(verifyRes.status).toBe(200);
    actorAccessToken = verifyRes.body.accessToken;

    const readonlyLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: readonlyEmail, password: readonlyPassword });
    expect(readonlyLogin.status).toBe(200);
    readonlyAccessToken = readonlyLogin.body.accessToken;
  });

  it('1. RBAC: support_agent no puede crear planes (403) pero si leerlos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/plans')
      .set('Authorization', `Bearer ${readonlyAccessToken}`)
      .send({ code: `no-deberia-${suffix}`, name: 'No deberia crearse' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/plans')
      .set('Authorization', `Bearer ${readonlyAccessToken}`)
      .expect(200);
  });

  it('2. crea un plan (queda en draft, sin versiones todavia)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/plans')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ code: `pro-${suffix}`, name: 'Plan Pro E2E' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    planId = res.body.id;
  });

  it('3. agregar una version activa el plan y guarda una instantania de precio/limites', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/versions`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        name: 'Pro mensual v1',
        priceAmount: 9900,
        currency: 'PEN',
        billingPeriod: 'monthly',
        trialDays: 14,
        maxUsers: 10,
        featureFlags: ['inventory', 'reports'],
        overagePolicy: 'alert',
      });

    expect(res.status).toBe(201);
    expect(res.body.versionNumber).toBe(1);
    expect(res.body.priceAmount).toBe(9900);
    planVersionId = res.body.id;

    const plan = await request(app.getHttpServer())
      .get(`/api/v1/plans/${planId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(plan.body.status).toBe('active');
  });

  it('4. emite una licencia: con 14 dias de prueba en la version, arranca en trial', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/licenses')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ organizationId, planVersionId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('trial');
    expect(res.body.publicId).toMatch(/^LIC-/);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].toStatus).toBe('trial');
    licenseId = res.body.id;
  });

  it('5. RBAC: support_agent puede leer la licencia pero no suspenderla', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/licenses/${licenseId}`)
      .set('Authorization', `Bearer ${readonlyAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/suspend`)
      .set('Authorization', `Bearer ${readonlyAccessToken}`)
      .send({ reason: 'no deberia poder' })
      .expect(403);
  });

  it('6. la maquina de estados rechaza una transicion invalida (renovar algo en trial)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/renew`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ reason: 'no deberia aplicar' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/No se puede renew/);
  });

  it('7. suspende, reactiva y renueva la licencia (trial -> suspended -> active -> active)', async () => {
    const suspendRes = await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/suspend`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ reason: 'pago pendiente de confirmar' });
    expect(suspendRes.status).toBe(201);
    expect(suspendRes.body.status).toBe('suspended');

    const reactivateRes = await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/reactivate`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({});
    expect(reactivateRes.status).toBe(201);
    expect(reactivateRes.body.status).toBe('active');

    const beforeRenew = new Date(reactivateRes.body.endsAt).getTime();
    const renewRes = await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/renew`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ reason: 'renovacion mensual' });
    expect(renewRes.status).toBe(201);
    expect(renewRes.body.status).toBe('active');
    expect(new Date(renewRes.body.endsAt).getTime()).toBeGreaterThan(
      beforeRenew,
    );

    expect(
      renewRes.body.events.map((e: { toStatus: string }) => e.toStatus),
    ).toEqual(expect.arrayContaining(['trial', 'suspended', 'active']));
  });

  it('8. la organizacion muestra la licencia en su overview', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/overview`)
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.licenses).toHaveLength(1);
    expect(res.body.licenses[0].id).toBe(licenseId);
  });

  it('9. revoca la licencia (terminal) y ya no se puede volver a tocar', async () => {
    const revokeRes = await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/revoke`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ reason: 'cliente cancelo el contrato' });
    expect(revokeRes.status).toBe(201);
    expect(revokeRes.body.status).toBe('revoked');

    await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/renew`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({})
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/licenses/${licenseId}/revoke`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ reason: 'doble revocacion' })
      .expect(409);
  });

  it('10. la cadena de auditoria sigue siendo integra', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.previousHash).toBe(rows[i - 1]!.hash);
    }
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'plans.created',
        'plans.version_created',
        'licenses.issued',
        'licenses.suspended',
        'licenses.reactivated',
        'licenses.renewed',
        'licenses.revoked',
      ]),
    );
  });
});
