import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * El proceso de la API se conecta con APP_DATABASE_URL (rol `app_runtime`,
 * sin permiso de UPDATE/DELETE sobre audit_logs -- ver migracion
 * 0002_app_runtime_role). Las migraciones usan DATABASE_URL (rol dueño de
 * las tablas). Ver docs/adr para el detalle de esta separacion.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: { url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
