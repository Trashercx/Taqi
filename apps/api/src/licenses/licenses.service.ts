import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { generatePublicId } from '../common/crypto';
import { addBillingPeriod, addDays, BillingPeriod } from './billing-period';
import {
  assertLicenseTransition,
  LicenseStatus,
} from './license-state-machine';
import { CreateLicenseDto } from './dto/create-license.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';
import { SuspendLicenseDto } from './dto/suspend-license.dto';
import { ReactivateLicenseDto } from './dto/reactivate-license.dto';
import { RevokeLicenseDto } from './dto/revoke-license.dto';
import { ListLicensesQueryDto } from './dto/list-licenses.query.dto';

const INCLUDE_DETAIL = {
  planVersion: { include: { plan: true } },
  organization: true,
  events: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class LicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListLicensesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      status: query.status,
      organizationId: query.organizationId,
    };

    const [items, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          planVersion: { include: { plan: true } },
          organization: true,
        },
      }),
      this.prisma.license.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string) {
    return this.findOrThrow(id);
  }

  /**
   * Emite una licencia nueva (SS6.5 "crear licencia con identificador
   * publico no secuencial"). No hay job de expiracion todavia: el paso
   * "active"/"trial" -> "past_due"/"grace_period"/"expired" por vencimiento
   * de `endsAt` queda pendiente para cuando se construya el worker de
   * alertas (SS6.8), que necesita el mismo scheduler.
   */
  async issue(actorId: string, dto: CreateLicenseDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!organization)
      throw new NotFoundException('Organizacion no encontrada');

    const planVersion = await this.prisma.planVersion.findUnique({
      where: { id: dto.planVersionId },
    });
    if (!planVersion)
      throw new NotFoundException('Version de plan no encontrada');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const status: LicenseStatus =
      dto.startStatus ?? (planVersion.trialDays > 0 ? 'trial' : 'active');

    const endsAt =
      status === 'trial'
        ? addDays(startsAt, planVersion.trialDays)
        : status === 'active'
          ? addBillingPeriod(
              startsAt,
              planVersion.billingPeriod as BillingPeriod,
            )
          : startsAt; // draft: el periodo real se fija al activar/renovar.

    const license = await this.prisma.$transaction(async (tx) => {
      const created = await tx.license.create({
        data: {
          publicId: generatePublicId('LIC'),
          organizationId: dto.organizationId,
          planVersionId: dto.planVersionId,
          status,
          startsAt,
          endsAt,
        },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: created.id,
          fromStatus: null,
          toStatus: status,
          actorId,
          reason: 'Emision de licencia',
        },
      });
      return created;
    });

    await this.audit.record({
      actorId,
      action: 'licenses.issued',
      resourceType: 'license',
      resourceId: license.id,
      metadata: {
        publicId: license.publicId,
        organizationId: dto.organizationId,
        status,
      },
    });

    return this.findOrThrow(license.id);
  }

  async renew(actorId: string, id: string, dto: RenewLicenseDto) {
    const license = await this.findOrThrow(id);
    const targetStatus = assertLicenseTransition(
      license.status as LicenseStatus,
      'renew',
    );

    const planVersion = dto.planVersionId
      ? await this.prisma.planVersion.findUnique({
          where: { id: dto.planVersionId },
        })
      : license.planVersion;
    if (!planVersion)
      throw new NotFoundException('Version de plan no encontrada');

    const now = new Date();
    const base = license.endsAt > now ? license.endsAt : now;
    const endsAt = addBillingPeriod(
      base,
      planVersion.billingPeriod as BillingPeriod,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id },
        data: {
          status: targetStatus,
          planVersionId: planVersion.id,
          endsAt,
          graceEndsAt: null,
        },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: id,
          fromStatus: license.status,
          toStatus: targetStatus,
          actorId,
          reason: dto.reason ?? 'Renovacion',
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'licenses.renewed',
      resourceType: 'license',
      resourceId: id,
      reason: dto.reason,
      metadata: {
        newEndsAt: endsAt.toISOString(),
        planVersionId: planVersion.id,
      },
    });

    return this.findOrThrow(id);
  }

  async suspend(actorId: string, id: string, dto: SuspendLicenseDto) {
    return this.transition(
      actorId,
      id,
      'suspend',
      dto.reason,
      'licenses.suspended',
    );
  }

  async reactivate(actorId: string, id: string, dto: ReactivateLicenseDto) {
    const license = await this.findOrThrow(id);
    const targetStatus = assertLicenseTransition(
      license.status as LicenseStatus,
      'reactivate',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id },
        data: { status: targetStatus, graceEndsAt: null },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: id,
          fromStatus: license.status,
          toStatus: targetStatus,
          actorId,
          reason: dto.reason ?? 'Reactivacion',
        },
      });
    });

    await this.audit.record({
      actorId,
      action: 'licenses.reactivated',
      resourceType: 'license',
      resourceId: id,
      reason: dto.reason,
    });

    return this.findOrThrow(id);
  }

  async revoke(actorId: string, id: string, dto: RevokeLicenseDto) {
    return this.transition(
      actorId,
      id,
      'revoke',
      dto.reason,
      'licenses.revoked',
    );
  }

  private async transition(
    actorId: string,
    id: string,
    action: 'suspend' | 'revoke',
    reason: string,
    auditAction: string,
  ) {
    const license = await this.findOrThrow(id);
    const targetStatus = assertLicenseTransition(
      license.status as LicenseStatus,
      action,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id },
        data: { status: targetStatus },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: id,
          fromStatus: license.status,
          toStatus: targetStatus,
          actorId,
          reason,
        },
      });
    });

    await this.audit.record({
      actorId,
      action: auditAction,
      resourceType: 'license',
      resourceId: id,
      reason,
    });

    return this.findOrThrow(id);
  }

  private async findOrThrow(id: string) {
    const license = await this.prisma.license.findUnique({
      where: { id },
      include: INCLUDE_DETAIL,
    });
    if (!license) throw new NotFoundException('Licencia no encontrada');
    return license;
  }
}
