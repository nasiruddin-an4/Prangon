/**
 * The permission catalog. The database `permissions` table is seeded from this
 * list, so role editors in every tenant pick from the same keys, and the API
 * and web app reference them with type checking.
 *
 * Keys are `<module>.<action>`. Modules from later roadmap phases are listed
 * now so institutions can configure their roles once, up front.
 */
export const PERMISSION_CATALOG = {
  // Platform (Super Admin only: never granted to tenant roles)
  'platform.institutions.manage': { module: 'platform', label: 'Create, suspend and configure institutions' },

  // Phase 1 – Foundation
  'institution.settings.read': { module: 'institution', label: 'View institution settings' },
  'institution.settings.update': { module: 'institution', label: 'Update institution settings and branding' },
  'campuses.read': { module: 'campuses', label: 'View campuses' },
  'campuses.manage': { module: 'campuses', label: 'Create and edit campuses' },
  'users.read': { module: 'users', label: 'View user accounts' },
  'users.manage': { module: 'users', label: 'Create, edit, suspend users and assign roles' },
  'roles.read': { module: 'roles', label: 'View roles and permissions' },
  'roles.manage': { module: 'roles', label: 'Create roles and change their permissions' },
  'audit.read': { module: 'audit', label: 'View the audit log' },
  'dashboard.view': { module: 'dashboard', label: 'View the institution dashboard' },
  'api_keys.manage': { module: 'api_keys', label: 'Create and revoke API keys for integrations' },

  // Phase 2 – Students & Admission
  'students.read': { module: 'students', label: 'View student records' },
  'students.manage': { module: 'students', label: 'Create and edit student records' },
  'students.import': { module: 'students', label: 'Bulk import students' },
  'guardians.read': { module: 'guardians', label: 'View guardians' },
  'guardians.manage': { module: 'guardians', label: 'Create and edit guardians' },
  'admissions.read': { module: 'admissions', label: 'View admission applications' },
  'admissions.review': { module: 'admissions', label: 'Review, approve or reject applications' },
  'admissions.manage': { module: 'admissions', label: 'Manage admission sessions and circulars' },

  // Phase 3 – Academic Management
  'academics.read': { module: 'academics', label: 'View faculties, departments, programs and courses' },
  'academics.manage': { module: 'academics', label: 'Manage the academic structure' },
  'routines.manage': { module: 'routines', label: 'Manage class routines and room allocation' },

  // Phase 4 – Attendance & Examinations
  'attendance.take': { module: 'attendance', label: 'Take attendance for assigned classes' },
  'attendance.read': { module: 'attendance', label: 'View attendance reports' },
  'exams.manage': { module: 'exams', label: 'Create exams and schedules' },
  'marks.enter': { module: 'exams', label: 'Enter marks for assigned courses' },
  'results.publish': { module: 'exams', label: 'Verify and publish results' },

  // Phase 5 – Finance
  'finance.read': { module: 'finance', label: 'View invoices, payments and financial reports' },
  'finance.collect': { module: 'finance', label: 'Record payments and issue receipts' },
  'finance.manage': { module: 'finance', label: 'Manage fee structures, scholarships and refunds' },

  // People, library, communication
  'teachers.read': { module: 'teachers', label: 'View teachers and staff' },
  'teachers.manage': { module: 'teachers', label: 'Manage teachers and staff' },
  'library.manage': { module: 'library', label: 'Manage books, issues and returns' },
  'announcements.manage': { module: 'communication', label: 'Publish announcements and notifications' },
  'reports.read': { module: 'reports', label: 'View and export reports' },

  // Self-service portals
  'portal.student': { module: 'portal', label: 'Use the student portal (own records only)' },
  'portal.guardian': { module: 'portal', label: 'Use the guardian portal (linked students only)' },
} as const satisfies Record<string, { module: string; label: string }>;

export type Permission = keyof typeof PERMISSION_CATALOG;

export const ALL_PERMISSIONS = Object.keys(PERMISSION_CATALOG) as Permission[];

/** Every permission a tenant role may hold (platform permissions excluded). */
export const TENANT_PERMISSIONS = ALL_PERMISSIONS.filter((key) => !key.startsWith('platform.'));

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSION_CATALOG, value);
}
