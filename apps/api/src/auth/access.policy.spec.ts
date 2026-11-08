import { AccessPolicy } from './access.policy.js';
import type { AuthUser } from './auth-user.js';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'u1',
  email: 't@demo.edu.bd',
  emailVerified: true,
  fullName: 'Teacher',
  institutionId: 'i1',
  isPlatformAdmin: false,
  roles: [],
  permissions: ['attendance.take', 'students.read'],
  campusScope: 'all',
  ...overrides,
});

describe('AccessPolicy', () => {
  const policy = new AccessPolicy();

  it('allows a permission one of the roles grants', () => {
    expect(policy.has(user(), 'attendance.take')).toBe(true);
  });

  it('denies a permission no role grants', () => {
    expect(policy.has(user(), 'finance.manage')).toBe(false);
  });

  it('denies guests', () => {
    expect(policy.has(null, 'students.read')).toBe(false);
    expect(policy.before(null)).toBeUndefined();
  });

  it('hasAny passes with at least one match', () => {
    expect(policy.hasAny(user(), ['roles.read', 'students.read'])).toBe(true);
    expect(policy.hasAny(user(), ['roles.read', 'users.manage'])).toBe(false);
  });

  it('lets platform Super Admins through before any ability runs', () => {
    expect(policy.before(user({ isPlatformAdmin: true, institutionId: null, permissions: [] }))).toBe(true);
    expect(policy.before(user())).toBeUndefined();
  });
});
