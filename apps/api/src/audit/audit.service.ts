import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditEventInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

/**
 * Bitacora append-only (SS6.9, SS8, ADR audit). Cada evento se encadena con
 * un hash sha256(previousHash + payload), y la escritura se serializa con
 * SELECT ... FOR UPDATE sobre audit_chain_lock para evitar condiciones de
 * carrera entre escritores concurrentes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: RecordAuditEventInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ tip_hash: string }[]>`
        SELECT tip_hash FROM audit_chain_lock WHERE id = 1 FOR UPDATE
      `;
      const previousHash = lock?.tip_hash ?? 'genesis';

      const payload = {
        actorId: event.actorId ?? null,
        actorEmail: event.actorEmail ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        reason: event.reason ?? null,
        metadata: event.metadata ?? null,
        ipHash: event.ipHash ?? null,
        userAgent: event.userAgent ?? null,
        previousHash,
      };
      const hash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      await tx.auditLog.create({
        data: {
          ...payload,
          metadata:
            (payload.metadata as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          hash,
        },
      });
      await tx.$executeRaw`UPDATE audit_chain_lock SET tip_hash = ${hash} WHERE id = 1`;
    });
  }
}
