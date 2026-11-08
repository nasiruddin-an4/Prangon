import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCampusInput, UpdateCampusInput } from '@edumanage/shared';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CampusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Campus-scoped users (e.g. a Campus Admin) see only their campuses. */
  list(institutionId: string, user: AuthUser) {
    return this.prisma.campus.findMany({
      where: {
        institutionId,
        ...(user.campusScope === 'all' ? {} : { id: { in: user.campusScope } }),
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
  }

  async get(institutionId: string, id: string) {
    const campus = await this.prisma.campus.findFirst({ where: { id, institutionId } });
    if (!campus) throw new NotFoundException('Campus not found');
    return campus;
  }

  async create(institutionId: string, input: CreateCampusInput) {
    try {
      const campus = await this.prisma.campus.create({ data: { ...input, institutionId } });
      await this.audit.record({ institutionId, action: 'campus.created', entityType: 'campus', entityId: campus.id, changes: input });
      return campus;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(institutionId: string, id: string, input: UpdateCampusInput) {
    await this.get(institutionId, id);
    try {
      const campus = await this.prisma.campus.update({ where: { id }, data: input });
      await this.audit.record({ institutionId, action: 'campus.updated', entityType: 'campus', entityId: id, changes: input });
      return campus;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A campus with this code already exists');
    }
    return error;
  }
}
