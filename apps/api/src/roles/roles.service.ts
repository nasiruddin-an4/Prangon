import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSION_CATALOG, TENANT_PERMISSIONS, type CreateRoleInput, type UpdateRoleInput } from '@edumanage/shared';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

const roleInclude = {
  permissions: { select: { permissionKey: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

const toDto = ({ permissions, _count, ...role }: RoleRow) => ({
  ...role,
  permissions: permissions.map((p) => p.permissionKey),
  userCount: _count.users,
});

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The catalog a role editor picks from (platform permissions excluded). */
  catalog() {
    return TENANT_PERMISSIONS.map((key) => ({ key, ...PERMISSION_CATALOG[key] }));
  }

  async list(institutionId: string) {
    const roles = await this.prisma.role.findMany({
      where: { institutionId },
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(toDto);
  }

  async create(institutionId: string, actor: AuthUser, input: CreateRoleInput) {
    this.assertGrantable(actor, input.permissions);
    const key = slugKey(input.name);
    try {
      const role = await this.prisma.role.create({
        data: {
          institutionId,
          key,
          name: input.name,
          description: input.description,
          permissions: { create: input.permissions.map((permissionKey) => ({ permissionKey })) },
        },
        include: roleInclude,
      });
      await this.audit.record({ institutionId, action: 'role.created', entityType: 'role', entityId: role.id, changes: input });
      return toDto(role);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with this name already exists');
      }
      throw error;
    }
  }

  async update(institutionId: string, actor: AuthUser, id: string, input: UpdateRoleInput) {
    const existing = await this.prisma.role.findFirst({ where: { id, institutionId }, include: roleInclude });
    if (!existing) throw new NotFoundException('Role not found');
    if (input.permissions) {
      // Only the permissions being added or removed need to be held by the editor.
      const before = new Set(existing.permissions.map((p) => p.permissionKey));
      const after = new Set<string>(input.permissions);
      const changed = [...after].filter((p) => !before.has(p)).concat([...before].filter((p) => !after.has(p)));
      this.assertGrantable(actor, changed);
      if (existing.key === 'institution_admin' && !actor.isPlatformAdmin) {
        throw new ForbiddenException('The Institution Admin role always has every permission');
      }
    }
    const role = await this.prisma.$transaction(async (tx) => {
      if (input.permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: input.permissions.map((permissionKey) => ({ roleId: id, permissionKey })) });
      }
      const updated = await tx.role.update({
        where: { id },
        data: { name: input.name, description: input.description },
        include: roleInclude,
      });
      await this.audit.record({ institutionId, action: 'role.updated', entityType: 'role', entityId: id, changes: input }, tx);
      return updated;
    });
    return toDto(role);
  }

  async remove(institutionId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, institutionId }, include: roleInclude });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('Default roles cannot be deleted');
    if (role._count.users > 0) throw new BadRequestException('Unassign this role from its users first');
    await this.prisma.role.delete({ where: { id } });
    await this.audit.record({ institutionId, action: 'role.deleted', entityType: 'role', entityId: id, changes: { name: role.name } });
  }

  private assertGrantable(actor: AuthUser, permissions: readonly string[]) {
    const tenant = new Set<string>(TENANT_PERMISSIONS);
    if (permissions.some((p) => !tenant.has(p))) {
      throw new BadRequestException('Platform permissions cannot be granted to institution roles');
    }
    if (actor.isPlatformAdmin) return;
    const held = new Set<string>(actor.permissions);
    const missing = permissions.filter((p) => !held.has(p));
    if (missing.length) {
      throw new ForbiddenException(`You cannot grant or revoke permissions you don't have: ${missing.join(', ')}`);
    }
  }
}

const slugKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'role';
