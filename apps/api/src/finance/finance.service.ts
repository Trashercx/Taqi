import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { monthKey, monthsAgoStart } from './month-key';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import { VoidFinancialTransactionDto } from './dto/void-financial-transaction.dto';
import { ListFinancialTransactionsQueryDto } from './dto/list-financial-transactions.query.dto';
import { FinanceDashboardQueryDto } from './dto/finance-dashboard.query.dto';

const OPTIMISTIC_LOCK_MESSAGE =
  'El movimiento fue modificado por otra persona; recarga e intenta de nuevo.';
const OPEN_LICENSE_STATUSES = [
  'trial',
  'active',
  'past_due',
  'grace_period',
] as const;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Catalogos (categorias / centros de costo) ---------------------------
  // No estan en la lista literal de SS9, pero son plomeria imprescindible:
  // sin categorias no se puede crear un movimiento (categoryId es requerido).

  listCategories() {
    return this.prisma.financialCategory.findMany({ orderBy: { code: 'asc' } });
  }

  async createCategory(actorId: string, dto: CreateFinancialCategoryDto) {
    const existing = await this.prisma.financialCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException('Ya existe una categoria con ese codigo');

    const category = await this.prisma.financialCategory.create({ data: dto });
    await this.audit.record({
      actorId,
      action: 'finance.category_created',
      resourceType: 'financial_category',
      resourceId: category.id,
      metadata: { code: category.code, kind: category.kind },
    });
    return category;
  }

  listCostCenters() {
    return this.prisma.costCenter.findMany({ orderBy: { code: 'asc' } });
  }

  async createCostCenter(actorId: string, dto: CreateCostCenterDto) {
    const existing = await this.prisma.costCenter.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException(
        'Ya existe un centro de costo con ese codigo',
      );

    const costCenter = await this.prisma.costCenter.create({ data: dto });
    await this.audit.record({
      actorId,
      action: 'finance.cost_center_created',
      resourceType: 'cost_center',
      resourceId: costCenter.id,
      metadata: { code: costCenter.code },
    });
    return costCenter;
  }

  // --- Movimientos financieros ----------------------------------------------

  async list(query: ListFinancialTransactionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      type: query.type,
      status: query.status,
      organizationId: query.organizationId,
      categoryId: query.categoryId,
      ...(query.from || query.to
        ? {
            issuedAt: {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, costCenter: true },
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string) {
    return this.findOrThrow(id);
  }

  async create(actorId: string, dto: CreateFinancialTransactionDto) {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    if (category.kind !== dto.type) {
      throw new BadRequestException(
        'La categoria no corresponde al tipo de movimiento (ingreso/gasto)',
      );
    }

    if (dto.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({
        where: { id: dto.costCenterId },
      });
      if (!costCenter)
        throw new NotFoundException('Centro de costo no encontrado');
    }
    if (dto.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!organization)
        throw new NotFoundException('Organizacion no encontrada');
    }

    const transaction = await this.prisma.financialTransaction.create({
      data: {
        type: dto.type,
        status: dto.status ?? 'pending',
        categoryId: dto.categoryId,
        costCenterId: dto.costCenterId,
        organizationId: dto.organizationId,
        counterparty: dto.counterparty,
        currency: dto.currency ?? 'PEN',
        amount: dto.amount,
        exchangeRate: dto.exchangeRate,
        paymentMethod: dto.paymentMethod,
        description: dto.description,
        issuedAt: new Date(dto.issuedAt),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
    });

    await this.audit.record({
      actorId,
      action: 'finance.transaction_created',
      resourceType: 'financial_transaction',
      resourceId: transaction.id,
      metadata: {
        type: dto.type,
        amount: dto.amount,
        currency: transaction.currency,
      },
    });

    return this.findOrThrow(transaction.id);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateFinancialTransactionDto,
  ) {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'voided') {
      throw new ConflictException(
        'No se puede modificar un movimiento anulado',
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      if (category.kind !== existing.type) {
        throw new BadRequestException(
          'La categoria no corresponde al tipo de movimiento (ingreso/gasto)',
        );
      }
    }
    if (dto.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({
        where: { id: dto.costCenterId },
      });
      if (!costCenter)
        throw new NotFoundException('Centro de costo no encontrado');
    }

    const result = await this.prisma.financialTransaction.updateMany({
      where: { id, version: dto.version },
      data: {
        categoryId: dto.categoryId,
        costCenterId: dto.costCenterId,
        counterparty: dto.counterparty,
        paymentMethod: dto.paymentMethod,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        status: dto.status,
        version: { increment: 1 },
      },
    });

    if (result.count === 0)
      throw new ConflictException(OPTIMISTIC_LOCK_MESSAGE);

    await this.audit.record({
      actorId,
      action: 'finance.transaction_updated',
      resourceType: 'financial_transaction',
      resourceId: id,
    });

    return this.findOrThrow(id);
  }

  async void(actorId: string, id: string, dto: VoidFinancialTransactionDto) {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'voided') {
      throw new ConflictException('El movimiento ya esta anulado');
    }

    const result = await this.prisma.financialTransaction.updateMany({
      where: { id, version: dto.version },
      data: {
        status: 'voided',
        voidedAt: new Date(),
        voidReason: dto.reason,
        version: { increment: 1 },
      },
    });

    if (result.count === 0)
      throw new ConflictException(OPTIMISTIC_LOCK_MESSAGE);

    await this.audit.record({
      actorId,
      action: 'finance.transaction_voided',
      resourceType: 'financial_transaction',
      resourceId: id,
      reason: dto.reason,
    });

    return this.findOrThrow(id);
  }

  /**
   * SS6.7: flujo de caja por mes, MRR/ARR e ingreso/gasto pagados en el
   * rango. "Presupuesto frente a ejecucion" queda fuera (ver nota en
   * schema.prisma: no hay entidad de presupuesto en SS8 que lo respalde).
   */
  async dashboard(query: FinanceDashboardQueryDto) {
    const months = query.months ?? 6;
    const rangeStart = monthsAgoStart(months - 1);

    const paidTransactions = await this.prisma.financialTransaction.findMany({
      where: { status: 'paid', paidAt: { gte: rangeStart } },
      select: { type: true, amount: true, paidAt: true },
    });

    const byMonth = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < months; i++) {
      const monthStart = monthsAgoStart(months - 1 - i, new Date());
      byMonth.set(monthKey(monthStart), { income: 0, expense: 0 });
    }
    for (const tx of paidTransactions) {
      const bucket = byMonth.get(monthKey(tx.paidAt!));
      if (!bucket) continue;
      if (tx.type === 'income') bucket.income += tx.amount;
      else bucket.expense += tx.amount;
    }

    const cashFlowByMonth = [...byMonth.entries()].map(
      ([month, { income, expense }]) => ({
        month,
        income,
        expense,
        net: income - expense,
      }),
    );

    const totalIncome = cashFlowByMonth.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = cashFlowByMonth.reduce((sum, m) => sum + m.expense, 0);

    const activeLicenses = await this.prisma.license.findMany({
      where: { status: { in: [...OPEN_LICENSE_STATUSES] } },
      include: { planVersion: true },
    });
    const mrr = activeLicenses.reduce((sum, license) => {
      const monthlyEquivalent =
        license.planVersion.billingPeriod === 'yearly'
          ? Math.round(license.planVersion.priceAmount / 12)
          : license.planVersion.priceAmount;
      return sum + monthlyEquivalent;
    }, 0);

    return {
      period: { months, from: rangeStart.toISOString() },
      mrr,
      arr: mrr * 12,
      cashFlowByMonth,
      grossMarginEstimate: {
        income: totalIncome,
        expense: totalExpense,
        margin: totalIncome - totalExpense,
      },
    };
  }

  private async findOrThrow(id: string) {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: { category: true, costCenter: true, organization: true },
    });
    if (!transaction)
      throw new NotFoundException('Movimiento financiero no encontrado');
    return transaction;
  }
}
