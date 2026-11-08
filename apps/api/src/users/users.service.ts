import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserInput, PaginationInput, UpdateUserInput } from '@edumanage/shared';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { CredentialsService } from '../auth/credentials.service.js';
import { paginated, skipTake } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Never select the password hash. */
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  status: true,
  emailVerified: true,
  lastSignInAt: true,
  createdAt: true,
  roles: {
    select: {
      id: true,
      campusId: true,
      role: { select: { id: true, key: true, name: true } },
      campus: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.UserSelect;

type RoleAssignment = { roleId: string; campusId?: string | null };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  async list(institutionId: string, query: PaginationInput) {
    const where: Prisma.UserWhereInput = {
      institutionId,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: userSelect, orderBy: { createdAt: 'desc' }, ...skipTake(query) }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async get(institutionId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, institutionId }, select: userSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(institutionId: string, actor: AuthUser, input: CreateUserInput) {
    await this.assertAssignable(institutionId, actor, input.roles);
    const passwordHash = await this.credentials.hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            institutionId,
            email: input.email,
            fullName: input.fullName,
            phone: input.phone,
            passwordHash,
            createdById: actor.id,
            roles: { create: input.roles.map((r) => ({ roleId: r.roleId, campusId: r.campusId ?? null })) },
          },
          select: userSelect,
        });
        await this.audit.record(
          { institutionId, action: 'user.created', entityType: 'user', entityId: user.id, changes: { email: user.email, roles: input.roles } },
          tx,
        );
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists in this institution');
      }
      throw error;
    }
  }

  async update(institutionId: string, actor: AuthUser, id: string, input: UpdateUserInput) {
    await this.get(institutionId, id);
    if (id === actor.id && (input.status || input.roles)) {
      throw new BadRequestException('You cannot change your own status or roles');
    }
    if (input.roles) {
      await this.assertAssignable(institutionId, actor, input.roles);
    }
    return this.prisma.$transaction(async (tx) => {
      if (input.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: input.roles.map((r) => ({ userId: id, roleId: r.roleId, campusId: r.campusId ?? null })),
        });
      }
      const user = await tx.user.update({
        where: { id },
        data: { fullName: input.fullName, phone: input.phone, status: input.status },
        select: userSelect,
      });
      await this.audit.record(
        { institutionId, action: input.roles ? 'user.roles_changed' : 'user.updated', entityType: 'user', entityId: id, changes: input },
        tx,
      );
      return user;
    });
  }

  /**
   * Roles and campuses must belong to this institution, and nobody may grant
   * a role carrying permissions they don't hold themselves (no privilege
   * escalation through user management).
   */
  private async assertAssignable(institutionId: string, actor: AuthUser, assignments: RoleAssignment[]) {
    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const campusIds = [...new Set(assignments.map((a) => a.campusId).filter((c): c is string => !!c))];
    const [roles, campuses] = await Promise.all([
      this.prisma.role.findMany({
        where: { id: { in: roleIds }, institutionId },
        include: { permissions: { select: { permissionKey: true } } },
      }),
      this.prisma.campus.count({ where: { id: { in: campusIds }, institutionId } }),
    ]);
    if (roles.length !== roleIds.length || campuses !== campusIds.length) {
      throw new BadRequestException('Unknown role or campus');
    }
    if (actor.isPlatformAdmin) return;
    const held = new Set<string>(actor.permissions);
    // Portal permissions only ever reach the holder's own records (a student's
    // own results, a guardian's linked children), so granting them is not
    // escalation: anyone who manages users may create student/guardian logins.
    const escalating = roles.find((role) => role.permissions.some((p) => !held.has(p.permissionKey) && !p.permissionKey.startsWith('portal.')));
    if (escalating) {
      throw new ForbiddenException(`You cannot assign "${escalating.name}": it grants permissions you don't have`);
    }
  }
}
