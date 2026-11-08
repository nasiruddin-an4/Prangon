import type { Permission } from '@edumanage/shared';

/**
 * The principal every authenticated request carries, loaded fresh from the
 * database on each request (so a suspended user or a changed role takes effect
 * immediately).
 */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  /** NULL for platform Super Admins. */
  institutionId: string | null;
  isPlatformAdmin: boolean;
  roles: { id: string; key: string; name: string; campusId: string | null }[];
  permissions: Permission[];
  /** Campuses the user's roles cover: `all`, or a list when every role is campus-scoped. */
  campusScope: 'all' | string[];
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
  }
}
