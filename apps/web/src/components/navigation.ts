import type { Permission } from "@edumanage/shared";
import type { IconName } from "./icons";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Shown only to users holding this permission. */
  permission?: Permission;
  /** Shown to users holding any one of these. */
  anyOf?: Permission[];
  /** Acts on one institution: a Super Admin must pick one first. */
  tenant?: boolean;
  /** Hidden from platform Super Admins (e.g. API keys belong to institution accounts). */
  tenantUsersOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const PLATFORM_NAV: NavItem[] = [
  { label: "Overview", href: "/", icon: "home" },
  { label: "Institutions", href: "/platform/institutions", icon: "building" },
];

/**
 * Ordered by how often each page is used and by the student lifecycle
 * (apply → enroll → study → assess → pay), with one-time setup at the bottom.
 * Items hide per permission, so each role sees a short menu.
 */
export const INSTITUTION_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: "home", permission: "dashboard.view" }],
  },
  {
    title: "Students",
    items: [
      { label: "Admissions", href: "/admissions", icon: "clipboard", permission: "admissions.read", tenant: true },
      { label: "Students", href: "/students", icon: "graduation", permission: "students.read", tenant: true },
      { label: "Guardians", href: "/guardians", icon: "user", permission: "guardians.read", tenant: true },
      { label: "Student affairs", href: "/student-affairs", icon: "megaphone", permission: "students.read", tenant: true },
      { label: "Clearance", href: "/clearance", icon: "check", anyOf: ["students.manage", "finance.collect", "library.manage", "academics.manage"], tenant: true },
      { label: "ID cards & certificates", href: "/documents", icon: "idCard", permission: "students.manage", tenant: true },
      { label: "Student portal preview", href: "/portal", icon: "home", anyOf: ["students.read", "portal.student"], tenant: true },
    ],
  },
  {
    title: "Academic",
    items: [
      { label: "Class routine", href: "/routine", icon: "clock", permission: "academics.read", tenant: true },
      { label: "Attendance", href: "/attendance", icon: "calendar", anyOf: ["attendance.take", "attendance.read"], tenant: true },
      { label: "Exams & marks", href: "/exams", icon: "pencil", anyOf: ["exams.manage", "marks.enter"], tenant: true },
      { label: "Results & transcripts", href: "/results", icon: "fileText", anyOf: ["results.publish", "exams.manage", "marks.enter"], tenant: true },
      { label: "Academic setup", href: "/academics", icon: "book", permission: "academics.manage", tenant: true },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Teachers & staff", href: "/teachers", icon: "users", permission: "teachers.read", tenant: true },
      { label: "Leave", href: "/leave", icon: "umbrella", permission: "dashboard.view", tenant: true },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Fees & payments", href: "/fees", icon: "wallet", permission: "finance.read", tenant: true },
      { label: "Scholarships", href: "/scholarships", icon: "receipt", permission: "finance.read", tenant: true },
      { label: "Expenses & payroll", href: "/expenses", icon: "banknote", permission: "finance.manage", tenant: true },
    ],
  },
  {
    title: "Campus services",
    items: [
      { label: "Library", href: "/library", icon: "bookOpen", permission: "library.manage", tenant: true },
      { label: "Transport", href: "/transport", icon: "bus", permission: "students.read", tenant: true },
      { label: "Hostel", href: "/hostel", icon: "bed", permission: "students.read", tenant: true },
    ],
  },
  {
    title: "Communication",
    items: [{ label: "Notices", href: "/notices", icon: "megaphone", permission: "dashboard.view", tenant: true }],
  },
  {
    title: "Reports",
    items: [{ label: "Reports", href: "/reports", icon: "chart", permission: "reports.read", tenant: true }],
  },
  {
    title: "Administration",
    items: [
      { label: "Campuses", href: "/campuses", icon: "mapPin", permission: "campuses.read", tenant: true },
      { label: "Users", href: "/users", icon: "shield", permission: "users.read", tenant: true },
      { label: "Roles & permissions", href: "/roles", icon: "lock", permission: "roles.read", tenant: true },
      { label: "Settings", href: "/settings", icon: "settings", permission: "institution.settings.read", tenant: true },
      { label: "API keys", href: "/api-keys", icon: "key", permission: "api_keys.manage", tenant: true, tenantUsersOnly: true },
      { label: "Audit log", href: "/audit-logs", icon: "history", permission: "audit.read", tenant: true },
    ],
  },
];

/**
 * What a student sees after signing in: only their own records. Staff with
 * students.read can open the same pages as a preview of any student.
 */
const PORTAL_ACCESS: Permission[] = ["portal.student", "students.read"];
export const PORTAL_NAV: NavSection[] = [
  {
    title: "My portal",
    items: [
      { label: "Dashboard", href: "/portal", icon: "home", anyOf: PORTAL_ACCESS, tenant: true },
      { label: "My profile", href: "/portal/profile", icon: "user", anyOf: PORTAL_ACCESS, tenant: true },
    ],
  },
  {
    title: "Academics",
    items: [
      { label: "Courses & routine", href: "/portal/academics", icon: "book", anyOf: PORTAL_ACCESS, tenant: true },
      { label: "Attendance & leave", href: "/portal/attendance", icon: "calendar", anyOf: PORTAL_ACCESS, tenant: true },
      { label: "Exams & results", href: "/portal/exams", icon: "fileText", anyOf: PORTAL_ACCESS, tenant: true },
    ],
  },
  {
    title: "Accounts & library",
    items: [
      { label: "Fees & payments", href: "/portal/accounts", icon: "wallet", anyOf: PORTAL_ACCESS, tenant: true },
      { label: "Library", href: "/portal/library", icon: "bookOpen", anyOf: PORTAL_ACCESS, tenant: true },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "Certificates & support", href: "/portal/services", icon: "award", anyOf: PORTAL_ACCESS, tenant: true },
      { label: "Notices", href: "/portal/notices", icon: "megaphone", anyOf: PORTAL_ACCESS, tenant: true },
    ],
  },
];

// Portal items first, so /portal resolves to the student's "Dashboard" rather than the staff preview link.
export const ALL_ITEMS = [...PLATFORM_NAV, ...PORTAL_NAV.flatMap((s) => s.items), ...INSTITUTION_NAV.flatMap((s) => s.items)];

/** The nav item a path belongs to: the longest matching prefix wins (/portal/accounts before /portal). */
export function findItem(pathname: string) {
  return ALL_ITEMS.filter((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`))).sort((a, b) => b.href.length - a.href.length)[0];
}

/** A signed-in student (or guardian): portal permissions only, no staff dashboard. */
export const isPortalOnly = (can: (p: Permission) => boolean, isPlatformAdmin: boolean) => !isPlatformAdmin && can("portal.student") && !can("dashboard.view");

/** Whether a user with `can` may open this item. */
export const allowed = (item: NavItem, can: (p: Permission) => boolean) =>
  (!item.permission || can(item.permission)) && (!item.anyOf || item.anyOf.some(can));
