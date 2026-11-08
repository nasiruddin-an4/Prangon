import { Can, Policy, type PolicyBefore } from '@nestjs/authorization';
import type { Permission } from '@edumanage/shared';
import type { AuthUser } from './auth-user.js';

/**
 * Role-based access: a user may do what any of their roles grants.
 * Platform Super Admins pass every check.
 */
@Policy()
export class AccessPolicy implements PolicyBefore<AuthUser> {
  before(user: AuthUser | null) {
    if (user?.isPlatformAdmin) {
      return true;
    }
  }

  has(user: AuthUser | null, permission: Permission) {
    return !!user && user.permissions.includes(permission);
  }

  hasAny(user: AuthUser | null, permissions: readonly Permission[]) {
    return !!user && permissions.some((p) => user.permissions.includes(p));
  }
}

/** Route guard: the caller needs this permission. */
export const RequirePermission = (permission: Permission) =>
  Can(AccessPolicy, 'has', () => [permission] as const);

/** Route guard: the caller needs at least one of these permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  Can(AccessPolicy, 'hasAny', () => [permissions] as const);
