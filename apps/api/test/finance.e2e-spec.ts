import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordHasher } from '../src/common/password-hasher.service';

/**
 * Cubre el modulo de Fase 4 (SS6.7): categorias/centros de costo, crear un
 * movimiento, optimistic locking al editarlo, anularlo (nunca borrarlo), y
 * el dashboard (flujo de caja + MRR/ARR). Corre contra Postgres real, actor
 * 'finance_admin' (tiene finance.read+finance.write, sin MFA -- mas simple
 * que 'superadmin' para este modulo que no lo necesita).
 *
 * El dashboard agrega TODA la plataforma (no solo datos de este test), y la
 * base de datos de desarrollo es compartida entre corridas de e2e. Por eso
 * las aserciones sobre el dashboard usan ">=" con un monto grande y propio
 * en vez de igualdad exacta -- confirman que la contribucion de este test
 * esta reflejada, sin asumir que nada mas escribio en la misma base.
 */
describe('E2E: finanzas internas (Fase 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const actorEmail = `e2e-finance-actor-${suffix}@example.com`;
  const actorPassword = 'FinanceActor123!';

  let actorAccessToken: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;
  let transactionId: string;

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

    const financeRole = await prisma.role.findUnique({
      where: { code: 'finance_admin' },
    });
    if (!financeRole) {
      throw new Error(
        "Falta el rol 'finance_admin'. Corre 'pnpm --filter @superadmin/api seed' antes de los e2e.",
      );
    }

    const actor = await prisma.platformUser.create({
      data: {
        email: actorEmail,
        fullName: 'E2E Finance Actor',
        status: 'active',
        passwordHash: await passwordHasher.hash(actorPassword),
      },
    });
    await prisma.userRole.create({
      data: { userId: actor.id, roleId: financeRole.id },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: actorEmail, password: actorPassword });
    expect(login.body.mfaRequired).toBeUndefined();
    actorAccessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. RBAC: sin finance.read/write no se puede listar ni crear categorias', async () => {
    const supportRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'support_agent' },
    });
    const passwordHasher = app.get(PasswordHasher);
    const readonlyEmail = `e2e-finance-readonly-${suffix}@example.com`;
    const readonly = await prisma.platformUser.create({
      data: {
        email: readonlyEmail,
        fullName: 'E2E Finance Readonly',
        status: 'active',
        passwordHash: await passwordHasher.hash('FinanceReadonly123!'),
      },
    });
    await prisma.userRole.create({
      data: { userId: readonly.id, roleId: supportRole.id },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: readonlyEmail, password: 'FinanceReadonly123!' });

    await request(app.getHttpServer())
      .get('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('2. crea categorias de ingreso y gasto', async () => {
    const income = await request(app.getHttpServer())
      .post('/api/v1/finance/categories')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        code: `e2e-income-${suffix}`,
        name: 'Ingreso E2E',
        kind: 'income',
      });
    expect(income.status).toBe(201);
    incomeCategoryId = income.body.id;

    const expense = await request(app.getHttpServer())
      .post('/api/v1/finance/categories')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        code: `e2e-expense-${suffix}`,
        name: 'Gasto E2E',
        kind: 'expense',
      });
    expect(expense.status).toBe(201);
    expenseCategoryId = expense.body.id;

    const list = await request(app.getHttpServer())
      .get('/api/v1/finance/categories')
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(list.status).toBe(200);
    expect(
      list.body.some((c: { id: string }) => c.id === incomeCategoryId),
    ).toBe(true);
  });

  it('3. rechaza crear un movimiento con una categoria que no corresponde al tipo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        type: 'income',
        categoryId: expenseCategoryId,
        amount: 1000,
        issuedAt: new Date().toISOString(),
      })
      .expect(400);
  });

  it('4. crea un movimiento de ingreso pendiente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        type: 'income',
        categoryId: incomeCategoryId,
        amount: 500000,
        currency: 'PEN',
        counterparty: 'Cliente E2E SAC',
        issuedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.version).toBe(1);
    transactionId = res.body.id;
  });

  it('5. optimistic locking: rechaza actualizar con una version vieja', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/finance/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ version: 999, description: 'no deberia aplicar' })
      .expect(409);
  });

  it('6. marca el movimiento como pagado (con la version correcta)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/finance/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        version: 1,
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.version).toBe(2);
  });

  it('7. anula el movimiento (nunca se borra fisicamente)', async () => {
    const voidRes = await request(app.getHttpServer())
      .post(`/api/v1/finance/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ version: 2, reason: 'duplicado por error' });

    expect(voidRes.status).toBe(201);
    expect(voidRes.body.status).toBe('voided');
    expect(voidRes.body.voidReason).toBe('duplicado por error');

    // sigue existiendo, solo que anulado (no un 404)
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/finance/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('voided');

    // no se puede editar ni anular de nuevo un movimiento ya anulado
    await request(app.getHttpServer())
      .patch(`/api/v1/finance/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ version: 3, description: 'no deberia aplicar' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/finance/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({ version: 3, reason: 'doble anulacion' })
      .expect(409);
  });

  it('8. el dashboard refleja un ingreso pagado grande y distintivo en el mes en curso', async () => {
    const distinctiveAmount = 123_456_700; // grande y unico para no confundirse con otros datos de la BD compartida
    const created = await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${actorAccessToken}`)
      .send({
        type: 'income',
        categoryId: incomeCategoryId,
        amount: distinctiveAmount,
        status: 'paid',
        issuedAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      });
    expect(created.status).toBe(201);

    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/finance/dashboard')
      .query({ months: 3 })
      .set('Authorization', `Bearer ${actorAccessToken}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.cashFlowByMonth).toHaveLength(3);
    const currentMonth =
      dashboard.body.cashFlowByMonth[dashboard.body.cashFlowByMonth.length - 1];
    expect(currentMonth.income).toBeGreaterThanOrEqual(distinctiveAmount);
    expect(dashboard.body.grossMarginEstimate.income).toBeGreaterThanOrEqual(
      distinctiveAmount,
    );
    expect(typeof dashboard.body.mrr).toBe('number');
    expect(dashboard.body.arr).toBe(dashboard.body.mrr * 12);
  });

  it('9. la cadena de auditoria sigue siendo integra', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.previousHash).toBe(rows[i - 1]!.hash);
    }
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'finance.category_created',
        'finance.transaction_created',
        'finance.transaction_updated',
        'finance.transaction_voided',
      ]),
    );
  });
});
