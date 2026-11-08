import { TENANT_PERMISSIONS, type Permission } from './permissions.js';

/**
 * Roles every new institution starts with. They are ordinary rows afterwards:
 * an institution can change their permissions, but cannot delete them
 * (`isSystem`), so the portals always have a role to attach users to.
 */
export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const DEFAULT_ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: 'institution_admin',
    name: 'Institution Admin',
    description: 'Full control of this institution',
    permissions: TENANT_PERMISSIONS.filter((p) => !p.startsWith('portal.')),
  },
  {
    key: 'campus_admin',
    name: 'Campus Admin',
    description: 'Manages an assigned campus',
    permissions: [
      'dashboard.view', 'campuses.read', 'users.read', 'users.manage', 'roles.read',
      'students.read', 'students.manage', 'guardians.read', 'guardians.manage',
      'academics.read', 'routines.manage', 'attendance.read', 'teachers.read', 'reports.read',
    ],
  },
  {
    key: 'director',
    name: 'Principal / Director',
    description: 'Monitors institutional performance (read-only)',
    permissions: [
      'dashboard.view', 'institution.settings.read', 'campuses.read', 'users.read', 'roles.read',
      'students.read', 'admissions.read', 'academics.read', 'attendance.read', 'finance.read',
      'teachers.read', 'reports.read', 'audit.read',
    ],
  },
  {
    key: 'registrar',
    name: 'Registrar',
    description: 'Student records and enrollment',
    permissions: [
      'dashboard.view', 'campuses.read', 'students.read', 'students.manage', 'students.import',
      'guardians.read', 'guardians.manage', 'admissions.read', 'academics.read', 'results.publish', 'reports.read',
    ],
  },
  {
    key: 'admission_officer',
    name: 'Admission Officer',
    description: 'Applications and admission',
    permissions: ['dashboard.view', 'admissions.read', 'admissions.review', 'admissions.manage', 'students.read', 'academics.read'],
  },
  {
    key: 'department_head',
    name: 'Department Head',
    description: 'Department and academic oversight',
    permissions: [
      'dashboard.view', 'students.read', 'academics.read', 'academics.manage', 'routines.manage',
      'attendance.read', 'exams.manage', 'marks.enter', 'teachers.read', 'reports.read',
    ],
  },
  {
    key: 'teacher',
    name: 'Teacher',
    description: 'Assigned classes, attendance and marks',
    permissions: ['dashboard.view', 'students.read', 'academics.read', 'attendance.take', 'attendance.read', 'marks.enter'],
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Fees, payments and expenses',
    permissions: ['dashboard.view', 'students.read', 'finance.read', 'finance.collect', 'finance.manage', 'reports.read'],
  },
  {
    key: 'librarian',
    name: 'Librarian',
    description: 'Books and library operations',
    permissions: ['dashboard.view', 'students.read', 'library.manage'],
  },
  {
    key: 'hr',
    name: 'HR / Staff',
    description: 'Employee management',
    permissions: ['dashboard.view', 'teachers.read', 'teachers.manage', 'users.read'],
  },
  {
    key: 'student',
    name: 'Student',
    description: 'Personal academic portal',
    permissions: ['portal.student'],
  },
  {
    key: 'guardian',
    name: 'Guardian',
    description: 'Monitors linked students',
    permissions: ['portal.guardian'],
  },
];
