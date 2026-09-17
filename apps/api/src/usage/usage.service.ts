import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  startOfCurrentMonth,
  truncateToDay,
  truncateToHour,
} from './date-bucket';
import { buildQuotaStatus } from './quota-status';
import { RecordUsageEventDto } from './dto/record-usage-event.dto';
import { UsageSummaryQueryDto } from './dto/usage-summary.query.dto';
import { UsageTimeseriesQueryDto } from './dto/usage-timeseries.query.dto';

const OPEN_LICENSE_STATUSES = [
  'trial',
  'active',
  'past_due',
  'grace_period',
] as const;

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ingesta de un evento de consumo (SS6.6). Agrega de forma sincrona (ver
   * nota en prisma/schema.prisma sobre por que todavia no es asincrono via
   * worker) dentro de la misma transaccion que el INSERT del evento crudo,
   * asi el agregado nunca queda desincronizado del evento que lo origino.
   */
  async recordEvent(actorId: string, dto: RecordUsageEventDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!organization)
      throw new NotFoundException('Organizacion no encontrada');

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const quantity = dto.quantity ?? 1;
    const hourBucket = truncateToHour(occurredAt);
    const dayBucket = truncateToDay(occurredAt);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.usageEvent.create({
        data: {
          organizationId: dto.organizationId,
          metric: dto.metric,
          quantity,
          occurredAt,
          ...(dto.metadata
            ? { metadata: dto.metadata as Prisma.InputJsonValue }
            : {}),
        },
      });

      await tx.usageAggregateHourly.upsert({
        where: {
          organizationId_metric_periodStart: {
            organizationId: dto.organizationId,
            metric: dto.metric,
            periodStart: hourBucket,
          },
        },
        create: {
          organizationId: dto.organizationId,
          metric: dto.metric,
          periodStart: hourBucket,
          totalQuantity: quantity,
          eventCount: 1,
        },
        update: {
          totalQuantity: { increment: quantity },
          eventCount: { increment: 1 },
        },
      });

      await tx.usageAggregateDaily.upsert({
        where: {
          organizationId_metric_periodStart: {
            organizationId: dto.organizationId,
            metric: dto.metric,
            periodStart: dayBucket,
          },
        },
        create: {
          organizationId: dto.organizationId,
          metric: dto.metric,
          periodStart: dayBucket,
          totalQuantity: quantity,
          eventCount: 1,
        },
        update: {
          totalQuantity: { increment: quantity },
          eventCount: { increment: 1 },
        },
      });

      return created;
    });

    await this.audit.record({
      actorId,
      action: 'usage.event_recorded',
      resourceType: 'usage_event',
      resourceId: event.id,
      metadata: {
        organizationId: dto.organizationId,
        metric: dto.metric,
        quantity,
      },
    });

    return event;
  }

  /** Totales por metrica en un rango (SS9 GET /usage/summary), leidos de los agregados diarios. */
  async summary(query: UsageSummaryQueryDto) {
    const from = query.from ? new Date(query.from) : startOfCurrentMonth();
    const to = query.to ? new Date(query.to) : new Date();

    const rows = await this.prisma.usageAggregateDaily.groupBy({
      by: ['metric'],
      where: { metric: query.metric, periodStart: { gte: from, lte: to } },
      _sum: { totalQuantity: true, eventCount: true },
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      metrics: rows.map((row) => ({
        metric: row.metric,
        totalQuantity: row._sum.totalQuantity ?? 0,
        eventCount: row._sum.eventCount ?? 0,
      })),
    };
  }

  /** Serie temporal de una metrica (SS9 GET /usage/timeseries), para graficas. */
  async timeseries(query: UsageTimeseriesQueryDto) {
    const granularity = query.granularity ?? 'day';
    const from = query.from ? new Date(query.from) : startOfCurrentMonth();
    const to = query.to ? new Date(query.to) : new Date();

    const where = {
      metric: query.metric,
      organizationId: query.organizationId,
      periodStart: { gte: from, lte: to },
    };

    const rows =
      granularity === 'hour'
        ? await this.prisma.usageAggregateHourly.findMany({
            where,
            orderBy: { periodStart: 'asc' },
          })
        : await this.prisma.usageAggregateDaily.findMany({
            where,
            orderBy: { periodStart: 'asc' },
          });

    if (query.organizationId) {
      return {
        metric: query.metric,
        granularity,
        organizationId: query.organizationId,
        points: rows.map((row) => ({
          periodStart: row.periodStart,
          totalQuantity: row.totalQuantity,
          eventCount: row.eventCount,
        })),
      };
    }

    // Sin organizationId: suma todas las organizaciones por punto en el tiempo.
    const merged = new Map<
      string,
      { periodStart: Date; totalQuantity: number; eventCount: number }
    >();
    for (const row of rows) {
      const key = row.periodStart.toISOString();
      const existing = merged.get(key);
      if (existing) {
        existing.totalQuantity += row.totalQuantity;
        existing.eventCount += row.eventCount;
      } else {
        merged.set(key, {
          periodStart: row.periodStart,
          totalQuantity: row.totalQuantity,
          eventCount: row.eventCount,
        });
      }
    }

    return {
      metric: query.metric,
      granularity,
      points: [...merged.values()].sort(
        (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
      ),
    };
  }

  /** Consumo del mes en curso de una organizacion + estado de cuota vs su licencia activa. */
  async organizationUsage(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization)
      throw new NotFoundException('Organizacion no encontrada');

    const from = startOfCurrentMonth();
    const rows = await this.prisma.usageAggregateDaily.groupBy({
      by: ['metric'],
      where: { organizationId, periodStart: { gte: from } },
      _sum: { totalQuantity: true, eventCount: true },
    });
    const usageByMetric = new Map(
      rows.map((row) => [row.metric, row._sum.totalQuantity ?? 0]),
    );

    const activeLicense = await this.prisma.license.findFirst({
      where: { organizationId, status: { in: [...OPEN_LICENSE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      include: { planVersion: true },
    });

    return {
      organizationId,
      period: { from: from.toISOString(), to: new Date().toISOString() },
      metrics: rows.map((row) => ({
        metric: row.metric,
        totalQuantity: row._sum.totalQuantity ?? 0,
        eventCount: row._sum.eventCount ?? 0,
      })),
      quotas: activeLicense
        ? buildQuotaStatus(activeLicense.planVersion, usageByMetric)
        : [],
    };
  }
}
