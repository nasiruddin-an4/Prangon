import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { paginationSchema, type PaginationInput } from '@edumanage/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginated, skipTake } from '../common/pagination.js';

export interface AuditEntry {
  institutionId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
  /** Defaults to the signed-in user. */
  actor?: { id: string; fullName: string } | null;
}

/** Append-only history of sensitive actions. Never updated or deleted by the app. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthenticationContext,
  ) {}

  /** Records an entry. Pass `tx` to commit it with the change it describes. */
  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    const actor = entry.actor === undefined ? this.auth.user : entry.actor;
    try {
      await tx.auditLog.create({
        data: {
          institutionId: entry.institutionId,
          actorId: actor?.id ?? null,
          actorName: actor?.fullName ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          changes: entry.changes,
        },
      });
    } catch (error) {
      // Inside a transaction the failure must abort the change; outside, log it.
      if (tx !== this.prisma) throw error;
      this.logger.error(`Failed to write audit entry ${entry.action}`, error as Error);
    }
  }

  async list(institutionId: string, query: PaginationInput = paginationSchema.parse({})) {
    const where: Prisma.AuditLogWhereInput = {
      institutionId,
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { actorName: { contains: query.search, mode: 'insensitive' } },
              { entityType: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(query) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }
}
