import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { generateOpaqueToken, hashOpaqueToken } from '../src/common/crypto';

/**
 * Cubre la historia del Primer Sprint: "login -> organizacion -> invitacion".
 * Es una prueba de flujo secuencial (no casos aislados): cada `it` depende
 * del estado dejado por el anterior, igual que un operador real recorriendo
 * la aplicacion. Requiere que `pnpm seed` ya haya corrido contra la base de
 * datos objetivo (roles/permisos precargados) y corre contra Postgres real,
 * nunca contra un mock.
 */
function extractTotpSecret(provisioningUri: string): string {
  const secret = new URL(provisioningUri).searchParams.get('secret');
  if (!secret) throw new Error('provisioningUri sin parametro "secret"');
  return secret;
}

describe('E2E: login -> organizacion -> invitacion (Fase 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const actorEmail = `e2e-actor-${suffix}@example.com`;
  const actorPassword = 'ActorPassword123!';
  const invitedEmail = `e2e-invitado-${suffix}@example.com`;
  const invitedPassword = 'InvitedPassword123!';
  // RUC peruano: 11 digitos. Se arma con el sufijo para que cada corrida use
  // uno distinto y no choque con organizaciones de corridas anteriores.
  const organizationRuc = `20${String(suffix).slice(-9)}`;

  let actorInvitationToken: string;
  let actorTotpSecret: string;
  let actorAccessToken: string;
  let actorRefreshToken: string;
  let organizationId: string;
  let invitedToken: string;
  let invitedAccessToken: string;

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

    const superadminRole = await prisma.role.findUnique({
      where: { code: 'superadmin' },
    });
    if (!superadminRole) {
      throw new Error(
        "Falta el rol 'superadmin'. Corre 'pnpm --filter @superadmin/api seed' antes de los e2e.",
      );
    }

    // Bootstrap del actor como usuario invitado, igual que prisma/seed.ts
    // crea al Platform Owner inicial: insercion directa, aceptacion por HTTP.
    actorInvitationToken = generateOpaqueToken();
    const actor = await prisma.platformUser.create({
      data: {
        email: actorEmail,
        fullName: 'E2E Actor Superadmin',
        status: 'invited',
        invitationTokenHash: hashOpaqueToken(actorInvitationToken),
        invitationExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.userRole.create({
      data: { userId: actor.id, roleId: superadminRole.id },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. acepta la invitacion del actor y exige configurar MFA (rol superadmin)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/users/invitations/${actorInvitationToken}/accept`)
      .send({ password: actorPassword });

    expect(res.status).toBe(200);
    expect(res.body.mfaSetupRequired).toBe(true);
    expect(res.body.provisioningUri).toContain('otpauth://totp/');
    expect(typeof res.body.challengeToken).toBe('string');

    actorTotpSecret = extractTotpSecret(res.body.provisioningUri);

    const code = authenticator.generate(actorTotpSecret);
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: res.body.challengeToken, code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toEqual(expect.any(String));
    expect(verifyRes.body.refreshToken).toEqual(expect.any(String));
    actorAccessToken = verifyRes.body.accessToken;
    actorRefreshToken = verifyRes.body.refreshToken;
  });

  it('2. un login posterior con email+password vuelve a exigir el mismo MFA', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: actorEmail, password: actorPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfaRequired).toBe(true);
    expect(typeof loginRes.body.challengeToken).toBe('string');

    const code = authenticator.generate(actorTotpSecret);
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: loginRes.body.challengeToken, code });

    expect(verifyRes.status).toBe(200);
    actorAccessToken = verifyRes.body.accessToken;
    actorRefreshToken = verifyRes.body.refreshToken;
  });

  it('3. rota el refresh token y el anterior deja de servir', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: actorRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(actorRefreshToken);

    const oldRefreshToken = actorRefreshToken;
    actorAccessToken = res.body.accessToken;
    actorRefreshToken = res.body.refreshToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('4. rechaza peticiones a rutas protegidas sin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/organizations').expect(401);
  });

  it('5. crea una organizacion', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        legalName: 'Comercial E2E SAC',
        ruc: organizationRuc,
        email: 'contacto@e2e.pe',
        status: 'prospecto',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.legalName).toBe('Comercial E2E SAC');
    organizationId = res.body.id;
  });

  it('6. lista, obtiene y ve el resumen (overview) de la organizacion', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(listRes.status).toBe(200);
    expect(
      listRes.body.items.some((o: { id: string }) => o.id === organizationId),
    ).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.ruc).toBe(organizationRuc);

    const overviewRes = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/overview`)
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.organization.id).toBe(organizationId);
    expect(overviewRes.body.licenses).toEqual([]);
  });

  it('7. actualiza el estado de la organizacion', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ status: 'activo' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('activo');
  });

  it('8. invita a un segundo usuario con un rol que no exige MFA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        email: invitedEmail,
        fullName: 'E2E Invitado Support',
        roleCode: 'support_agent',
      });

    expect(res.status).toBe(201);
    expect(res.body.invitationToken).toEqual(expect.any(String));
    invitedToken = res.body.invitationToken;
  });

  it('9. el segundo usuario acepta la invitacion y entra sin MFA', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/users/invitations/${invitedToken}/accept`)
      .send({ password: invitedPassword });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.mfaSetupRequired).toBeUndefined();
    invitedAccessToken = res.body.accessToken;
  });

  it('10. RBAC: support_agent puede leer organizaciones pero no crearlas', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${invitedAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${invitedAccessToken}`)
      .send({ legalName: 'No deberia crearse' })
      .expect(403);
  });

  it('11. cierra la sesion del actor y revoca su refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ refreshToken: actorRefreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: actorRefreshToken })
      .expect(401);
  });

  it('12. la cadena de auditoria es integra de principio a fin', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.previousHash).toBe('genesis');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.previousHash).toBe(rows[i - 1]!.hash);
    }

    const lock = await prisma.auditChainLock.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(lock.tipHash).toBe(rows[rows.length - 1]!.hash);

    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'users.activated',
        'auth.mfa_enrolled',
        'auth.login_succeeded',
        'organizations.created',
        'organizations.updated',
        'users.invited',
        'auth.logout',
      ]),
    );
  });
});
