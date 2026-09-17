import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto';
import { ListPlansQueryDto } from './dto/list-plans.query.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPlansQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = { status: query.status };

    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      }),
      this.prisma.plan.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  async create(actorId: string, dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException('Ya existe un plan con ese codigo');

    const plan = await this.prisma.plan.create({
      data: { code: dto.code, name: dto.name },
    });

    await this.audit.record({
      actorId,
      action: 'plans.created',
      resourceType: 'plan',
      resourceId: plan.id,
      metadata: { code: plan.code },
    });

    return plan;
  }

  /**
   * Agrega una instantania inmutable de condiciones (SS6.4). La primera
   * version de un plan lo pasa automaticamente de "draft" a "active": sin
   * al menos una version no hay nada que licenciar, asi que un plan recien
   * creado no tiene forma util de quedar "activo" antes de tener precio y
   * limites definidos.
   */
  async addVersion(actorId: string, planId: string, dto: CreatePlanVersionDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    if (plan.status === 'archived') {
      throw new ConflictException(
        'No se pueden agregar versiones a un plan archivado',
      );
    }

    const lastVersion = await this.prisma.planVersion.findFirst({
      where: { planId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.planVersion.create({
        data: {
          planId,
          versionNumber,
          name: dto.name,
          priceAmount: dto.priceAmount,
          currency: dto.currency ?? 'PEN',
          billingPeriod: dto.billingPeriod,
          trialDays: dto.trialDays ?? 0,
          maxUsers: dto.maxUsers,
          maxBranches: dto.maxBranches,
          maxProducts: dto.maxProducts,
          maxWarehouses: dto.maxWarehouses,
          apiRequestLimit: dto.apiRequestLimit,
          storageLimitMb: dto.storageLimitMb,
          featureFlags: dto.featureFlags ?? [],
          overagePolicy: dto.overagePolicy ?? 'alert',
        },
      });
      if (plan.status === 'draft') {
        await tx.plan.update({
          where: { id: planId },
          data: { status: 'active' },
        });
      }
      return created;
    });

    await this.audit.record({
      actorId,
      action: 'plans.version_created',
      resourceType: 'plan_version',
      resourceId: version.id,
      metadata: { planId, versionNumber, priceAmount: version.priceAmount },
    });

    return version;
  }
}
