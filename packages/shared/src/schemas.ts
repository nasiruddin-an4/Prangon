import { z } from 'zod';
import { isPermission } from './permissions.js';

/**
 * Request schemas shared by the API (validation), the web app and the mobile
 * app (forms). One definition, so client and server never disagree.
 */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');

/** Bangladesh mobile numbers: 01XXXXXXXXX, optionally with +88. */
const bdPhone = z
  .string()
  .trim()
  .regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number');

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const passwordSchema = z.string().min(10, 'At least 10 characters').max(128);

// ── Auth ──────────────────────────────────────────────────────────────────
export const signInSchema = z.object({
  /** Omitted for platform (Super Admin) accounts. */
  institution: slug.optional(),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Institutions ──────────────────────────────────────────────────────────
export const institutionTypeSchema = z.enum(['UNIVERSITY', 'COLLEGE', 'SCHOOL', 'TRAINING_INSTITUTE']);
export const institutionStatusSchema = z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']);

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: optionalText(32),
  slug,
  type: institutionTypeSchema.default('UNIVERSITY'),
  email: z.email().optional(),
  phone: bdPhone.optional(),
  /** The first Institution Admin, created with the institution. */
  admin: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase(),
    password: passwordSchema,
  }),
  /** The main campus, created with the institution. */
  mainCampus: z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().toUpperCase().min(1).max(16),
  }),
});
export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;

export const updateInstitutionSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  shortName: optionalText(32),
  email: z.email().optional(),
  phone: bdPhone.optional(),
  website: z.url().optional(),
  address: optionalText(500),
  logoUrl: z.url().optional(),
  timezone: z.string().min(1).max(64).optional(),
  defaultLocale: z.enum(['en', 'bn']).optional(),
  /** Placeholders: {YYYY} {YY} {CAMPUS} {DEPT} {SEQ:n}. */
  studentIdFormat: z.string().trim().min(3).max(64).optional(),
});
export type UpdateInstitutionSettingsInput = z.infer<typeof updateInstitutionSettingsSchema>;

export const updateInstitutionStatusSchema = z.object({ status: institutionStatusSchema });

// ── Campuses ──────────────────────────────────────────────────────────────
export const campusSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().min(1).max(16).regex(/^[A-Z0-9-]+$/, 'Letters, digits and hyphens'),
  email: z.email().optional(),
  phone: bdPhone.optional(),
  address: optionalText(500),
  division: optionalText(64),
  district: optionalText(64),
  upazila: optionalText(64),
  isActive: z.boolean().default(true),
});
export const createCampusSchema = campusSchema;
export const updateCampusSchema = campusSchema.partial();
export type CreateCampusInput = z.infer<typeof createCampusSchema>;
export type UpdateCampusInput = z.infer<typeof updateCampusSchema>;

// ── Users & roles ─────────────────────────────────────────────────────────
export const userStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']);

export const roleAssignmentSchema = z.object({
  roleId: z.uuid(),
  /** Limits the role to one campus; omit for every campus. */
  campusId: z.uuid().nullable().optional(),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  phone: bdPhone.optional(),
  password: passwordSchema,
  roles: z.array(roleAssignmentSchema).min(1, 'Assign at least one role'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: bdPhone.optional(),
  status: userStatusSchema.optional(),
  roles: z.array(roleAssignmentSchema).min(1).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const permissionKey = z.string().refine(isPermission, 'Unknown permission');

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(255),
  permissions: z.array(permissionKey).default([]),
});
export const updateRoleSchema = createRoleSchema.partial();
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ── API keys ──────────────────────────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** Days until the key stops working. */
  expiresInDays: z.number().int().min(1).max(365).default(365),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ── Lists ─────────────────────────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
