import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasher } from '../src/common/password-hasher.service';
import { encryptSecret } from '../src/common/crypto';

/**
 * Cubre el modulo de Fase 3 (SS6.6): ingestar eventos de consumo, ver que
 * se reflejan en el resumen/serie temporal, y que el estado de cuota se
 * calcula bien contra el limite del PlanVersion de la licencia activa de
 * la organizacion. Corre contra Postgres real, actor 'superadmin' (con MFA
 * pre-verificado en DB, igual que plans-and-licenses.e2e-spec.ts).
 */
describe('E2E: medicion de uso y cuotas (Fase 3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const actorEmail = `e2e-usage-actor-${suffix}@example.com`;
  const actorPassword = 'UsageActor123!';
  const metric = `e2e_metric_${suffix}`;

  let actorAccessToken: string;
  let organizationId: string;
  let planVersionId: string;

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

    const superadminRole = await prisma.role.findUnique({
      where: { code: 'superadmin' },
    });
    if (!superadminRole) {
      throw new Error(
        "Falta el rol 'superadmin'. Corre 'pnpm --filter @superadmin/api seed' antes de los e2e.",
      );
    }

    const actor = await prisma.platformUser.create({
      data: {
        email: actorEmail,
        fullName: 'E2E Usage Actor',
        status: 'active',
        passwordHash: await passwordHasher.hash(actorPassword),
      },
    });
    await prisma.userRole.create({
      data: { userId: actor.id, roleId: superadminRole.id },
    });

    const actorTotpSecret = authenticator.generateSecret();
    await prisma.mfaMethod.create({
      data: {
        userId: actor.id,
        type: 'totp',
        secretEncrypted: encryptSecret(actorTotpSecret),
        backupCodeHashes: [],
        verifiedAt: new Date(),
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: actorEmail, password: actorPassword });
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        challengeToken: loginRes.body.challengeToken,
        code: authenticator.generate(actorTotpSecret),
      });
    actorAccessToken = verifyRes.body.accessToken;

    const organization = await prisma.organization.create({
      data: { legalName: `E2E Usage SAC ${suffix}`, status: 'activo' },
    });
    organizationId = organization.id;

    const plan = await prisma.plan.create({
      data: { code: `usage-plan-${suffix}`, name: 'Plan con cuota de API' },
    });
    const planVersion = await prisma.planVersion.create({
      data: {
        planId: plan.id,
        versionNumber: 1,
        name: 'v1',
        priceAmount: 5000,
        billingPeriod: 'monthly',
        apiRequestLimit: 100,
      },
    });
    planVersionId = planVersion.id;

    await prisma.license.create({
      data: {
        publicId: `LIC-USAGE-${suffix}`,
        organizationId,
        planVersionId,
        status: 'active',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. rechaza un metric con formato invalido (no snake_case)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/usage/events')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ organizationId, metric: 'Not Valid Metric!' })
      .expect(400);
  });

  it('2. ingesta tres eventos y quedan reflejados en el resumen', async () => {
    for (const quantity of [10, 15, 5]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/usage/events')
        .set('Authorization', `Bearer ${actorAccessToken}`)
        .send({ organizationId, metric, quantity });
      expect(res.status).toBe(201);
      expect(res.body.quantity).toBe(quantity);
    }

    const summaryRes = await request(app.getHttpServer())
      .get('/api/v1/usage/summary')
      .query({ metric })
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.metrics).toEqual([
      { metric, totalQuantity: 30, eventCount: 3 },
    ]);
  });

  it('3. la serie temporal (timeseries) agrupa los eventos por dia', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage/timeseries')
      .query({ metric, organizationId, granularity: 'day' })
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(1);
    expect(res.body.points[0].totalQuantity).toBe(30);
    expect(res.body.points[0].eventCount).toBe(3);
  });

  it('4. registra api_request y el estado de cuota lo compara contra el limite del plan', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/usage/events')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ organizationId, metric: 'api_request', quantity: 42 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/usage/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.quotas).toEqual([
      { metric: 'api_request', limit: 100, used: 42, percentUsed: 42 },
    ]);
    expect(
      res.body.metrics.find((m: { metric: string }) => m.metric === metric)
        .totalQuantity,
    ).toBe(30);
  });

  it('5. RBAC: sin capacidad usage.write no se pueden ingestar eventos', async () => {
    const supportRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'support_agent' },
    });
    const passwordHasher = app.get(PasswordHasher);
    const readonlyEmail = `e2e-usage-readonly-${suffix}@example.com`;
    const readonly = await prisma.platformUser.create({
      data: {
        email: readonlyEmail,
        fullName: 'E2E Usage Readonly',
        status: 'active',
        passwordHash: await passwordHasher.hash('UsageReadonly123!'),
      },
    });
    await prisma.userRole.create({
      data: { userId: readonly.id, roleId: supportRole.id },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: readonlyEmail, password: 'UsageReadonly123!' });
    expect(login.body.mfaRequired).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/usage/events')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ organizationId, metric, quantity: 1 })
      .expect(403);
  });

  it('6. una organizacion sin licencia activa no tiene cuotas, solo metricas', async () => {
    const orphan = await prisma.organization.create({
      data: {
        legalName: `E2E Usage Sin Licencia ${suffix}`,
        status: 'prospecto',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/usage/events')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ organizationId: orphan.id, metric, quantity: 7 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/usage/organizations/${orphan.id}`)
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.quotas).toEqual([]);
    expect(res.body.metrics).toEqual([
      { metric, totalQuantity: 7, eventCount: 1 },
    ]);
  });

  it('7. el overview de organizaciones incluye el uso real (ya no null)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/overview`)
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.usage.organizationId).toBe(organizationId);
    expect(res.body.usage.quotas).toEqual([
      { metric: 'api_request', limit: 100, used: 42, percentUsed: 42 },
    ]);
  });
});
