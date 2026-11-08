import { Controller, Get, Headers } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import type { DashboardSummary } from '@edumanage/shared';
import { RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Institution statistics. A Super Admin without a selected institution gets
   * platform-wide totals instead.
   */
  @Get('summary')
  @RequirePermission('dashboard.view')
  async summary(@CurrentUser() user: AuthUser, @Headers('x-institution-id') selected?: string): Promise<DashboardSummary> {
    const validSelection = selected && /^[0-9a-f-]{36}$/i.test(selected) ? selected : null;
    const institutionId = user.institutionId ?? (user.isPlatformAdmin ? validSelection : null);
    const scope = institutionId ? { institutionId } : {};

    const [institution, campuses, users, activeUsers, roles, institutions, activity] = await Promise.all([
      institutionId
        ? this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true, type: true, status: true } })
        : null,
      this.prisma.campus.count({ where: scope }),
      this.prisma.user.count({ where: { ...scope, isPlatformAdmin: false } }),
      this.prisma.user.count({ where: { ...scope, isPlatformAdmin: false, status: 'ACTIVE' } }),
      this.prisma.role.count({ where: scope }),
      institutionId ? undefined : this.prisma.institution.count(),
      this.prisma.auditLog.findMany({
        where: institutionId ? { institutionId } : {},
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, action: true, entityType: true, actorName: true, createdAt: true },
      }),
    ]);

    return {
      institution,
      counts: { campuses, users, activeUsers, roles, ...(institutions === undefined ? {} : { institutions }) },
      recentActivity: activity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    };
  }
}
