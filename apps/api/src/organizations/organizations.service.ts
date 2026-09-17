import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations.query.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListOrganizationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      status: query.status,
      ...(query.search
        ? {
            OR: [
              {
                legalName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                tradeName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              { ruc: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async findOne(id: string) {
    return this.findOrThrow(id);
  }

  async overview(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { contacts: true },
    });
    if (!organization)
      throw new NotFoundException('Organizacion no encontrada');

    return {
      organization,
      // Licencias, consumo y finanzas se conectan en las fases 2-4 del
      // roadmap; la vista 360 completa (SS6.2) se completa entonces.
      licenses: [],
      usage: null,
      recentActivity: [],
    };
  }

  async create(actorId: string, dto: CreateOrganizationDto) {
    const organization = await this.prisma.organization.create({ data: dto });
    await this.audit.record({
      actorId,
      action: 'organizations.created',
      resourceType: 'organization',
      resourceId: organization.id,
      metadata: { legalName: organization.legalName },
    });
    return organization;
  }

  async update(id: string, actorId: string, dto: UpdateOrganizationDto) {
    await this.findOrThrow(id);
    const organization = await this.prisma.organization.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      actorId,
      action: 'organizations.updated',
      resourceType: 'organization',
      resourceId: organization.id,
      metadata: { fields: Object.keys(dto) },
    });
    return organization;
  }

  private async findOrThrow(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!organization)
      throw new NotFoundException('Organizacion no encontrada');
    return organization;
  }
}
