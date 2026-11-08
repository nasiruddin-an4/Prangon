"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPortalOnly } from "@/components/navigation";
import type { DashboardSummary, Permission } from "@edumanage/shared";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { Icon, type IconName } from "@/components/icons";
import { useDemo } from "@/lib/demo/store";
import { attendanceStats, invoiceTotals, MIN_ATTENDANCE, taka, todayDhaka } from "@/lib/demo/logic";
import { Avatar, Badge, Card, EmptyState, ErrorNote, Loading, PageHeader, StatCard, timeAgo } from "@/components/ui";

const QUICK_ACTIONS: { label: string; description: string; href: string; icon: IconName; permission: Permission }[] = [
  { label: "Admissions", description: "Review new applications", href: "/admissions", icon: "clipboard", permission: "admissions.read" },
  { label: "Students", description: "Profiles, guardians, records", href: "/students", icon: "graduation", permission: "students.read" },
  { label: "Attendance", description: "Take today's attendance", href: "/attendance", icon: "calendar", permission: "attendance.take" },
  { label: "Exams & marks", description: "Enter marks for your courses", href: "/exams", icon: "pencil", permission: "marks.enter" },
  { label: "Collect fees", description: "Invoices, bKash, Nagad, cash", href: "/fees", icon: "wallet", permission: "finance.read" },
  { label: "Class routine", description: "Weekly class schedule", href: "/routine", icon: "clock", permission: "academics.read" },
  { label: "Users", description: "Invite staff and assign roles", href: "/users", icon: "users", permission: "users.read" },
  { label: "Settings", description: "Profile, language, student IDs", href: "/settings", icon: "settings", permission: "institution.settings.read" },
];

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

export default function DashboardPage() {
  const { me, can, tenant } = useAuth();
  const router = useRouter();
  const portalOnly = !!me && isPortalOnly(can, me.isPlatformAdmin);
  // Students have no staff dashboard: their home is the portal.
  useEffect(() => {
    if (portalOnly) router.replace("/portal");
  }, [portalOnly, router]);
  const { data, error, loading } = useApi<DashboardSummary>(me && !portalOnly ? "/dashboard/summary" : null);
  const platformView = !!me?.isPlatformAdmin && !tenant;

  return (
    <>
      <PageHeader
        eyebrow={platformView ? "Platform overview" : data?.institution?.type.replace("_", " ").toLowerCase()}
        // The clock is read only on the client (after sign-in loads), never while prerendering.
        title={me ? `${greeting()}, ${me.fullName.split(" ")[0]}` : "Welcome"}
        description={platformView ? "Every institution on EduManage at a glance." : data?.institution?.name}
        actions={
          data?.institution && (
            <Badge tone={data.institution.status === "ACTIVE" ? "success" : "warning"} dot>
              {data.institution.status}
            </Badge>
          )
        }
      />
      <ErrorNote message={error?.message} />
      {loading && !data && <Loading />}

      {data && (
        <div className="space-y-6">
          <div className={data.counts.institutions !== undefined ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : "grid grid-cols-2 gap-4 lg:grid-cols-3"}>
            {data.counts.institutions !== undefined && <StatCard label="Institutions" value={data.counts.institutions} icon="building" />}
            <StatCard label="Campuses" value={data.counts.campuses} icon="mapPin" />
            <StatCard label="Active users" value={data.counts.activeUsers} sub={`of ${data.counts.users}`} icon="users" />
            <StatCard label="Roles" value={data.counts.roles} icon="shield" />
          </div>

          {platformView ? (
            <Card title="Manage an institution" description="Pick one in the sidebar under Managing, or create a new one.">
              <div className="flex flex-wrap gap-3 p-5">
                <Link href="/platform/institutions" className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent-soft">
                  <Icon name="building" className="size-5 text-accent" />
                  <span>
                    <span className="block font-medium">All institutions</span>
                    <span className="block text-xs text-muted">Create, activate or suspend tenants</span>
                  </span>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.filter((a) => can(a.permission)).map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                    <Icon name={a.icon} className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {a.label}
                      <Icon name="chevronRight" className="size-3.5 text-subtle transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="block text-xs text-muted">{a.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card title="Recent activity" description="Latest changes and sign-ins">
              {data.recentActivity.length === 0 ? (
                <EmptyState icon="activity" title="No activity yet" description="Changes and sign-ins will appear here." />
              ) : (
                <ul className="px-5 py-2">
                  {data.recentActivity.map((a, i) => (
                    <li key={a.id} className="relative flex gap-3 py-3">
                      {i < data.recentActivity.length - 1 && <span className="absolute top-12 bottom-0 left-[17px] w-px bg-border" />}
                      <Avatar name={a.actorName ?? "System"} />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm">
                          <span className="font-medium">{a.actorName ?? "System"}</span>{" "}
                          <span className="text-muted">{describe(a.action)}</span>
                        </p>
                        <p className="text-xs text-subtle">{timeAgo(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-6">
              <AcademicSnapshot />
              <PinnedNotices />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Headline numbers from the student, attendance and fee modules. */
function AcademicSnapshot() {
  const { db } = useDemo();
  const { can } = useAuth();
  if (!db) return <Card title="At a glance"><Loading /></Card>;
  const today = todayDhaka();
  const pending = db.applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const lowAttendance = active.filter((s) => {
    const pct = attendanceStats(db.attendance.filter((a) => a.sectionId === s.sectionId), s.id).percent;
    return pct !== null && pct < MIN_ATTENDANCE;
  }).length;
  const totals = db.invoices.map((i) => invoiceTotals(i, db.payments));
  const collected = totals.reduce((s, t) => s + t.paid, 0);
  const outstanding = totals.reduce((s, t) => s + t.due, 0);
  const todaySheets = db.attendance.filter((a) => a.date === today).length;
  const rows: { label: string; value: string; href: string; icon: IconName; tone?: string; show: boolean }[] = [
    { label: "Active students", value: active.length.toLocaleString("en-IN"), href: "/students", icon: "graduation", show: can("students.read") },
    { label: "Applications to review", value: String(pending), href: "/admissions", icon: "clipboard", tone: pending ? "text-accent" : undefined, show: can("admissions.read") },
    { label: `Below ${MIN_ATTENDANCE}% attendance`, value: String(lowAttendance), href: "/attendance", icon: "calendar", tone: lowAttendance ? "text-danger" : undefined, show: can("attendance.read") },
    { label: "Classes marked today", value: String(todaySheets), href: "/attendance", icon: "check", show: can("attendance.read") },
    { label: "Fees collected", value: taka(collected), href: "/fees", icon: "wallet", tone: "text-success", show: can("finance.read") },
    { label: "Fees outstanding", value: taka(outstanding), href: "/fees", icon: "alert", tone: outstanding ? "text-danger" : undefined, show: can("finance.read") },
  ];
  return (
    <Card title="At a glance" description="Students, attendance and fees this semester">
      <ul className="divide-y divide-border">
        {rows
          .filter((r) => r.show)
          .map((r) => (
            <li key={r.label}>
              <Link href={r.href} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60">
                <Icon name={r.icon} className="size-4 text-subtle" />
                <span className="flex-1 text-muted">{r.label}</span>
                <span className={`font-semibold tabular-nums ${r.tone ?? ""}`}>{r.value}</span>
              </Link>
            </li>
          ))}
      </ul>
    </Card>
  );
}

/** Pinned, unexpired notices from the Notices page. */
function PinnedNotices() {
  const { db } = useDemo();
  if (!db) return null;
  const today = todayDhaka();
  const pinned = db.notices.filter((n) => n.pinned && (!n.expiresOn || n.expiresOn >= today)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <Card title="Notice board" description="Pinned announcements" actions={<Link href="/notices" className="text-xs font-medium text-accent hover:underline">All notices</Link>}>
      {pinned.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No pinned notices.</p>
      ) : (
        <ul className="divide-y divide-border">
          {pinned.slice(0, 4).map((n) => (
            <li key={n.id} className="px-5 py-3">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
              <p className="mt-1 text-[11px] text-subtle">
                {n.author} · {timeAgo(n.publishedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** `campus.created` → "created a campus". */
function describe(action: string) {
  const known: Record<string, string> = {
    "auth.signed_in": "signed in",
    "auth.password_changed": "changed their password",
    "auth.signed_out_everywhere": "signed out on all devices",
    "institution.created": "created an institution",
    "institution.status_changed": "changed an institution's status",
    "institution.settings_updated": "updated institution settings",
    "campus.created": "added a campus",
    "campus.updated": "updated a campus",
    "user.created": "added a user",
    "user.updated": "updated a user",
    "user.roles_changed": "changed a user's roles",
    "role.created": "created a role",
    "role.updated": "changed a role's permissions",
    "role.deleted": "deleted a role",
    "api_key.created": "created an API key",
    "api_key.revoked": "revoked an API key",
  };
  return known[action] ?? action.replace(/[._]/g, " ");
}
