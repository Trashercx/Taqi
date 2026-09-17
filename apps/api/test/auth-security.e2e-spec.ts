import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasher } from '../src/common/password-hasher.service';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { generateOpaqueToken, hashOpaqueToken } from '../src/common/crypto';

/**
 * Cubre los mecanismos de seguridad que no forman parte del "camino feliz"
 * de onboarding-flow.e2e-spec.ts: bloqueo progresivo, recuperacion de
 * contrasena y suspension de cuentas. Usa una instancia de Nest propia (con
 * su propio contador de rate-limit) para no competir por el cupo de
 * /auth/login (5 peticiones/60s) con la otra suite.
 *
 * El bloqueo progresivo se ejerce mayormente llamando a AuthService de
 * forma directa (no HTTP): el limite de intentos fallidos (5) coincide a
 * proposito con el limite del throttle de /auth/login, así que repetir el
 * intento por HTTP disparara un 429 antes de llegar al 401 de bloqueo. La
 * logica de negocio es la misma sin importar el transporte; solo se deja
 * una llamada real por HTTP para probar el endpoint en si.
 */
describe('E2E: seguridad de autenticacion (Fase 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasher;
  let authService: AuthService;
  let usersService: UsersService;

  const suffix = Date.now();
  const lockoutEmail = `e2e-lockout-${suffix}@example.com`;
  const lockoutPassword = 'LockoutPassword123!';
  const resetEmail = `e2e-reset-${suffix}@example.com`;
  const suspendEmail = `e2e-suspend-${suffix}@example.com`;
  const suspendPassword = 'SuspendPassword123!';

  let resetUserId: string;
  let suspendUserId: string;

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
    passwordHasher = app.get(PasswordHasher);
    authService = app.get(AuthService);
    usersService = app.get(UsersService);

    const [lockoutHash, resetHash, suspendHash] = await Promise.all([
      passwordHasher.hash(lockoutPassword),
      passwordHasher.hash('ContraseñaOriginal123!'),
      passwordHasher.hash(suspendPassword),
    ]);

    await prisma.platformUser.create({
      data: {
        email: lockoutEmail,
        fullName: 'E2E Lockout',
        status: 'active',
        passwordHash: lockoutHash,
      },
    });

    const resetUser = await prisma.platformUser.create({
      data: {
        email: resetEmail,
        fullName: 'E2E Reset',
        status: 'active',
        passwordHash: resetHash,
      },
    });
    resetUserId = resetUser.id;

    const suspendUser = await prisma.platformUser.create({
      data: {
        email: suspendEmail,
        fullName: 'E2E Suspend',
        status: 'active',
        passwordHash: suspendHash,
      },
    });
    suspendUserId = suspendUser.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('acumula intentos fallidos y bloquea la cuenta tras 5 intentos', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(
        authService.login(lockoutEmail, 'contraseña-incorrecta', {}),
      ).rejects.toThrow('Credenciales invalidas');
    }

    let user = await prisma.platformUser.findUniqueOrThrow({
      where: { email: lockoutEmail },
    });
    expect(user.failedLoginCount).toBe(4);
    expect(user.lockedUntil).toBeNull();

    // Quinto intento fallido, esta vez por HTTP real (endpoint completo).
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: lockoutEmail, password: 'contraseña-incorrecta' })
      .expect(401);

    user = await prisma.platformUser.findUniqueOrThrow({
      where: { email: lockoutEmail },
    });
    expect(user.failedLoginCount).toBe(5);
    expect(user.lockedUntil).not.toBeNull();
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Ni siquiera con la contraseña correcta se puede entrar mientras dura el bloqueo.
    await expect(
      authService.login(lockoutEmail, lockoutPassword, {}),
    ).rejects.toThrow('Cuenta bloqueada temporalmente');
  });

  it('forgotPassword responde igual exista o no el correo (anti user-enumeration)', async () => {
    const existing = await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: resetEmail });
    const missing = await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'no-existe-nadie-con-este-correo@example.com' });

    expect(existing.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);
  });

  it('resetea la contraseña con un token valido y revoca las sesiones activas', async () => {
    const rawToken = generateOpaqueToken();
    await prisma.platformUser.update({
      where: { id: resetUserId },
      data: {
        passwordResetTokenHash: hashOpaqueToken(rawToken),
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: resetUserId,
        refreshTokenHash: hashOpaqueToken(generateOpaqueToken()),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: rawToken, newPassword: 'NuevaPassword456!' })
      .expect(204);

    const updatedUser = await prisma.platformUser.findUniqueOrThrow({
      where: { id: resetUserId },
    });
    expect(
      await passwordHasher.verify(
        updatedUser.passwordHash!,
        'NuevaPassword456!',
      ),
    ).toBe(true);
    expect(updatedUser.passwordResetTokenHash).toBeNull();

    const updatedSession = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(updatedSession.revokedAt).not.toBeNull();
    expect(updatedSession.revokedReason).toBe('password_reset');
  });

  it('rechaza un token de reset invalido o ya usado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: 'token-que-no-existe', newPassword: 'OtraPassword456!' })
      .expect(400);
  });

  it('suspende a un usuario y bloquea su siguiente inicio de sesion', async () => {
    await usersService.suspend(
      suspendUserId,
      'e2e-security-suite',
      'prueba automatizada',
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: suspendEmail, password: suspendPassword });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no esta activa/i);

    const updated = await prisma.platformUser.findUniqueOrThrow({
      where: { id: suspendUserId },
    });
    expect(updated.status).toBe('suspended');
  });

  it('la cadena de auditoria sigue siendo integra tras estas pruebas', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.previousHash).toBe(rows[i - 1]!.hash);
    }
    const lock = await prisma.auditChainLock.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(lock.tipHash).toBe(rows[rows.length - 1]!.hash);
  });
});
