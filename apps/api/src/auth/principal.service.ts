import { Injectable } from '@nestjs/common';
import { isPermission, type Permission } from '@edumanage/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

/** Institutions whose users may sign in. */
const USABLE_INSTITUTION = ['TRIAL', 'ACTIVE'] as const;

/** Turns a user row into the request principal, with roles and permissions resolved. */
@Injectable()
export class PrincipalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The user as a principal, or `null` when they may not act: deleted, not
   * ACTIVE, or their institution is suspended or cancelled.
   */
  async load(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        institution: { select: { status: true } },
        roles: {
          include: {
            role: { include: { permissions: { select: { permissionKey: true } } } },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }
    if (!user.isPlatformAdmin) {
      if (!user.institution || !USABLE_INSTITUTION.includes(user.institution.status as never)) {
        return null;
      }
    }

    const permissions = new Set<Permission>();
    for (const assignment of user.roles) {
      for (const { permissionKey } of assignment.role.permissions) {
        if (isPermission(permissionKey)) {
          permissions.add(permissionKey);
        }
      }
    }
    const campusIds = user.roles.map((r) => r.campusId);
    const campusScope = campusIds.length === 0 || campusIds.includes(null) ? 'all' : (campusIds as string[]);

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: user.fullName,
      institutionId: user.institutionId,
      isPlatformAdmin: user.isPlatformAdmin,
      roles: user.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name, campusId: r.campusId })),
      permissions: [...permissions],
      campusScope,
    };
  }
}
