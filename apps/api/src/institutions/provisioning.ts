import { DEFAULT_ROLE_TEMPLATES, type CreateInstitutionInput } from '@edumanage/shared';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Creates a ready-to-use tenant in one transaction: the institution, its main
 * campus, the default roles with their permissions, and the first Institution
 * Admin. Shared by the platform API and the seed script.
 */
export async function provisionInstitution(
  tx: Prisma.TransactionClient,
  input: CreateInstitutionInput,
  adminPasswordHash: string,
  createdById: string | null = null,
) {
  const institution = await tx.institution.create({
    data: {
      name: input.name,
      shortName: input.shortName,
      slug: input.slug,
      type: input.type,
      email: input.email,
      phone: input.phone,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await tx.campus.create({
    data: { institutionId: institution.id, name: input.mainCampus.name, code: input.mainCampus.code, isMain: true },
  });

  const roleIds = new Map<string, string>();
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const role = await tx.role.create({
      data: {
        institutionId: institution.id,
        key: template.key,
        name: template.name,
        description: template.description,
        isSystem: true,
        permissions: { create: template.permissions.map((permissionKey) => ({ permissionKey })) },
      },
    });
    roleIds.set(template.key, role.id);
  }

  const admin = await tx.user.create({
    data: {
      institutionId: institution.id,
      email: input.admin.email,
      fullName: input.admin.fullName,
      passwordHash: adminPasswordHash,
      createdById,
      roles: { create: { roleId: roleIds.get('institution_admin')! } },
    },
  });

  return { institution, admin };
}
