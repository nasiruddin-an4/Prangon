import type { Permission } from './permissions.js';

/** What `GET /api/v1/auth/me` returns, for the web and mobile apps. */
export interface Me {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  institution: { id: string; name: string; slug: string; type: string } | null;
  roles: { id: string; key: string; name: string; campusId: string | null }[];
  permissions: Permission[];
}

export interface DashboardSummary {
  institution: { name: string; type: string; status: string } | null;
  counts: {
    campuses: number;
    users: number;
    activeUsers: number;
    roles: number;
    institutions?: number;
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    actorName: string | null;
    createdAt: string;
  }[];
}
