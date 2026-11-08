import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateInstitutionInput,
  PaginationInput,
  UpdateInstitutionSettingsInput,
} from '@edumanage/shared';
import { Prisma } from '../generated/prisma/client.js';
import type { InstitutionStatus } from '../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { CredentialsService } from '../auth/credentials.service.js';
import { paginated, skipTake } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { provisionInstitution } from './provisioning.js';

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  // ── Platform (Super Admin) ────────────────────────────────────────────────

  async list(query: PaginationInput) {
    const where: Prisma.InstitutionWhereInput = query.search
      ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, campuses: true } } },
        ...skipTake(query),
      }),
      this.prisma.institution.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async create(input: CreateInstitutionInput, actorId: string) {
    const passwordHash = await this.credentials.hash(input.admin.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { institution, admin } = await provisionInstitution(tx, input, passwordHash, actorId);
        await this.audit.record(
          { institutionId: institution.id, action: 'institution.created', entityType: 'institution', entityId: institution.id, changes: { slug: institution.slug, adminEmail: admin.email } },
          tx,
        );
        return institution;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An institution with this slug already exists');
      }
      throw error;
    }
  }

  async setStatus(id: string, status: InstitutionStatus) {
    const institution = await this.prisma.institution.update({ where: { id }, data: { status } }).catch(() => {
      throw new NotFoundException();
    });
    await this.audit.record({ institutionId: id, action: 'institution.status_changed', entityType: 'institution', entityId: id, changes: { status } });
    return institution;
  }

  // ── Tenant (own institution) ──────────────────────────────────────────────

  async get(institutionId: string) {
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException();
    return institution;
  }

  async updateSettings(institutionId: string, input: UpdateInstitutionSettingsInput) {
    const institution = await this.prisma.institution.update({ where: { id: institutionId }, data: input });
    await this.audit.record({ institutionId, action: 'institution.settings_updated', entityType: 'institution', entityId: institutionId, changes: input });
    return institution;
  }
}
