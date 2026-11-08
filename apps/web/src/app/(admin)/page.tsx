"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { DashboardSummary, Permission } from "@edumanage/shared";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { useApi } from "@/lib/use-api";
import { useDemo } from "@/lib/demo/store";
import { attendanceStats, invoiceStatus, invoiceTotals, lookup, MIN_ATTENDANCE, monthLabel, semesterResult, taka, todayDhaka, WEEKDAYS } from "@/lib/demo/logic";
import type { DemoDb } from "@/lib/demo/types";
import { certificateStage, CLEARANCE_OFFICES, clearanceChecks } from "@/lib/demo/workflows";
import { Icon, type IconName } from "@/components/icons";
import { isPortalOnly } from "@/components/navigation";
import { Avatar, Badge, Card, cx, EmptyState, ErrorNote, Loading, PageHeader, StatCard, timeAgo } from "@/components/ui";

const QUICK_ACTIONS: { label: string; href: string; icon: IconName; permission: Permission }[] = [
  { label: "Take attendance", href: "/attendance", icon: "calendar", permission: "attendance.take" },
  { label: "Enter marks", href: "/exams", icon: "pencil", permission: "marks.enter" },
  { label: "Review applications", href: "/admissions", icon: "clipboard", permission: "admissions.review" },
  { label: "Collect fees", href: "/fees", icon: "wallet", permission: "finance.collect" },
  { label: "Issue a book", href: "/library", icon: "bookOpen", permission: "library.manage" },
  { label: "Post a notice", href: "/notices", icon: "megaphone", permission: "announcements.manage" },
  { label: "Find a student", href: "/students", icon: "search", permission: "students.read" },
  { label: "Class routine", href: "/routine", icon: "clock", permission: "academics.read" },
];

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};
const longDate = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
const nowHHMM = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date());
const weekday = (iso: string) => (["SUN", "MON", "TUE", "WED", "THU", null, "SAT"] as const)[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? null;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export default function DashboardPage() {
  const { me, can, tenant } = useAuth();
  const router = useRouter();
  const { db } = useDemo();
  const portalOnly = !!me && isPortalOnly(can, me.isPlatformAdmin);
  // Students have no staff dashboard: their home is the portal.
  useEffect(() => {
    if (portalOnly) router.replace("/portal");
  }, [portalOnly, router]);
  const { data, error, loading } = useApi<DashboardSummary>(me && !portalOnly ? "/dashboard/summary" : null);
  const platformView = !!me?.isPlatformAdmin && !tenant;
  const semester = db?.semesters.find((s) => s.status === "ONGOING");

  return (
    <>
      <PageHeader
        // The clock is read only on the client (after sign-in loads), never while prerendering.
        eyebrow={me ? (platformView ? "Platform overview" : `${longDate()}${semester ? ` · ${semester.name}` : ""}`) : undefined}
        title={me ? `${greeting()}, ${me.fullName.split(" ")[0]}` : "Welcome"}
        description={platformView ? `Every institution on ${BRAND.name} at a glance.` : data?.institution?.name}
        actions={
          data?.institution && (
            <Badge tone={data.institution.status === "ACTIVE" ? "success" : "warning"} dot>
              {data.institution.status === "ACTIVE" ? "Active" : data.institution.status.toLowerCase()}
            </Badge>
          )
        }
      />
      <ErrorNote message={error?.message} />
      {loading && !data && <Loading />}

      {data && platformView && <PlatformOverview data={data} />}
      {data && !platformView && (
        <div className="space-y-6">
          <QuickActions />
          {db ? <Headline db={db} /> : <Loading />}
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6">
              {db && <Attention db={db} />}
              {db && <Trends db={db} />}
            </div>
            <div className="min-w-0 space-y-6">
              {db && <Today db={db} />}
              {db && <NoticeBoard db={db} />}
              <Activity data={data} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Platform (Super Admin without an institution picked) ─────────────────

function PlatformOverview({ data }: { data: DashboardSummary }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Institutions" value={data.counts.institutions ?? 0} icon="building" />
        <StatCard label="Campuses" value={data.counts.campuses} icon="mapPin" />
        <StatCard label="Active users" value={data.counts.activeUsers} sub={`of ${data.counts.users}`} icon="users" />
        <StatCard label="Roles" value={data.counts.roles} icon="shield" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Activity data={data} />
        <Card title="Manage an institution" description="Pick one under Managing in the sidebar, or create a new one.">
          <div className="p-5">
            <Link href="/platform/institutions" className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent-soft">
              <Icon name="building" className="size-5 text-accent" />
              <span>
                <span className="block font-medium">All institutions</span>
                <span className="block text-xs text-muted">Create, activate or suspend</span>
              </span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────

function QuickActions() {
  const { can } = useAuth();
  const actions = QUICK_ACTIONS.filter((a) => can(a.permission));
  if (!actions.length) return null;
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link key={a.href + a.label} href={a.href} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm shadow-soft transition-colors hover:border-accent/40 hover:text-accent">
          <Icon name={a.icon} className="size-4 text-subtle" />
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

// ── Headline numbers ─────────────────────────────────────────────────────

function Headline({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const today = todayDhaka();
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const female = active.filter((s) => s.gender === "FEMALE").length;
  const percents = active.map((s) => attendanceStats(db.attendance.filter((a) => a.sectionId === s.sectionId), s.id).percent).filter((p): p is number => p !== null);
  const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
  const wd = weekday(today);
  const scheduled = wd ? db.routine.filter((r) => r.day === wd).length : 0;
  const marked = db.attendance.filter((a) => a.date === today).length;
  const totals = db.invoices.map((i) => invoiceTotals(i, db.payments));
  const billed = totals.reduce((s, t) => s + t.net, 0);
  const collected = totals.reduce((s, t) => s + t.paid, 0);
  const staff = db.staff.filter((s) => s.status !== "RESIGNED").length;

  const cards = [
    can("students.read") && <StatCard key="s" label="Active students" value={active.length} sub={`${pct(female, active.length)}% female`} icon="graduation" />,
    can("teachers.read") && <StatCard key="t" label="Faculty & staff" value={db.teachers.length + staff} sub={`${db.teachers.length} teachers`} icon="users" />,
    can("attendance.read") && <StatCard key="a" label="Attendance this semester" value={`${avg}%`} sub={wd ? `${marked} of ${scheduled} classes marked today` : "Friday"} icon="check" />,
    can("finance.read") && <StatCard key="f" label="Fees collected" value={`${pct(collected, billed)}%`} sub={`${taka(billed - collected)} outstanding`} icon="wallet" />,
  ].filter(Boolean);
  if (!cards.length) return null;
  return <div className={cx("grid grid-cols-2 gap-4", cards.length >= 4 ? "lg:grid-cols-4" : cards.length === 3 ? "lg:grid-cols-3" : "")}>{cards}</div>;
}

// ── Needs your attention: every office's queue, filtered to what you can act on ──

interface Task {
  label: string;
  count: number;
  href: string;
  icon: IconName;
  urgent?: boolean;
}

function Attention({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const today = todayDhaka();
  const tasks: Task[] = [];
  const add = (show: boolean, task: Task) => show && task.count > 0 && tasks.push(task);

  add(can("admissions.review"), { label: "Applications waiting for review", count: db.applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length, href: "/admissions", icon: "clipboard" });
  add(can("admissions.review"), { label: "Accepted applicants to enroll", count: db.applications.filter((a) => a.status === "ACCEPTED").length, href: "/admissions", icon: "graduation" });
  add(can("teachers.manage") || can("students.manage"), {
    label: "Leave requests to decide",
    count: db.leaves.filter((l) => l.status === "PENDING" && (l.person.type === "STUDENT" ? can("students.manage") : can("teachers.manage"))).length,
    href: "/leave",
    icon: "umbrella",
  });
  add(can("students.manage"), { label: "Certificate requests to verify", count: db.certificateRequests.filter((r) => certificateStage(db, r) === "SUBMITTED").length, href: "/documents", icon: "award" });
  add(can("students.manage"), { label: "Certificates paid and ready to issue", count: db.certificateRequests.filter((r) => certificateStage(db, r) === "READY").length, href: "/documents", icon: "award" });
  // Clearance: offices this user signs for whose check already passes.
  const signable = db.clearances
    .filter((c) => c.status === "IN_PROGRESS")
    .reduce((n, c) => {
      const checks = clearanceChecks(db, c.studentId);
      return n + CLEARANCE_OFFICES.filter((o) => can(o.permission) && !c.signoffs[o.key] && checks[o.key].ok).length;
    }, 0);
  add(true, { label: "Clearance sign-offs ready for your office", count: signable, href: "/clearance", icon: "check" });
  add(can("students.manage"), { label: "Clearances ready for final approval", count: db.clearances.filter((c) => c.status === "IN_PROGRESS" && CLEARANCE_OFFICES.every((o) => c.signoffs[o.key])).length, href: "/clearance", icon: "shield" });
  add(can("students.manage"), { label: "New student-affairs tickets", count: db.tickets.filter((t) => t.status === "SUBMITTED").length, href: "/student-affairs", icon: "megaphone", urgent: db.tickets.some((t) => t.status === "SUBMITTED" && t.confidential) });
  add(can("academics.manage"), { label: "Attendance corrections to approve", count: db.corrections.filter((c) => c.status === "PENDING").length, href: "/attendance", icon: "calendar" });
  add(can("finance.collect"), { label: "Overdue invoices", count: db.invoices.filter((i) => invoiceStatus(i, db.payments, today) === "OVERDUE").length, href: "/fees", icon: "wallet", urgent: true });
  add(can("library.manage"), { label: "Library books overdue", count: db.bookIssues.filter((i) => !i.returnedOn && i.dueOn < today).length, href: "/library", icon: "bookOpen", urgent: true });
  const readySections = db.sections.filter((sec) => {
    if (db.publications.some((p) => p.sectionId === sec.id)) return false;
    const rs = db.students.filter((s) => s.sectionId === sec.id && s.status !== "DROPPED").map((s) => semesterResult(db, sec.id, s.id)!);
    return rs.length > 0 && rs.every((r) => r.complete);
  }).length;
  add(can("results.publish"), { label: "Section results ready to publish", count: readySections, href: "/results", icon: "fileText" });
  add(can("attendance.read"), {
    label: `Students below ${MIN_ATTENDANCE}% attendance`,
    count: db.students.filter((s) => s.status === "ACTIVE" && (attendanceStats(db.attendance.filter((a) => a.sectionId === s.sectionId), s.id).percent ?? 100) < MIN_ATTENDANCE).length,
    href: "/attendance",
    icon: "alert",
  });

  tasks.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  return (
    <Card title="Needs your attention" description={tasks.length ? "Work waiting in your offices, from every department" : "You're all caught up"}>
      {tasks.length === 0 ? (
        <EmptyState icon="check" title="Nothing waiting" description="New requests from other offices and the student portal show up here." />
      ) : (
        <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
          {tasks.map((t) => (
            <li key={t.label} className="sm:border-b sm:border-border sm:odd:border-r">
              <Link href={t.href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", t.urgent ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent")}>
                  <Icon name={t.icon} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1 text-sm">{t.label}</span>
                <span className={cx("text-lg font-semibold tabular-nums", t.urgent && "text-danger")}>{t.count}</span>
                <Icon name="chevronRight" className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Trends ───────────────────────────────────────────────────────────────

/** Single-series bars: one hue, values as text, exact figure on hover. */
function Bars({ rows }: { rows: { label: string; value: number; display: string; sub?: string }[] }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3 p-5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.display}`} className="grid grid-cols-[minmax(5.5rem,28%)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-3/70">
            <span className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%` }} />
          </span>
          <span className="min-w-20 text-right font-medium tabular-nums">
            {r.display}
            {r.sub && <span className="ml-1.5 text-xs font-normal text-subtle">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Trends({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const months = [...new Set(db.payments.map((p) => p.paidAt.slice(0, 7)))].sort().slice(-4);
  const byMonth = months.map((m) => ({ m, sum: db.payments.filter((p) => p.paidAt.startsWith(m)).reduce((s, p) => s + p.amount, 0) }));
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const showFees = can("finance.read") && byMonth.length > 0;
  const showEnrollment = can("students.read");
  if (!showFees && !showEnrollment) return null;
  return (
    <div className={cx("grid gap-6", showFees && showEnrollment && "lg:grid-cols-2")}>
      {showFees && (
        <Card title="Fee collection" description="Payments received each month" actions={<Link href="/reports" className="text-xs font-medium text-accent hover:underline">Reports</Link>}>
          <Bars rows={byMonth.map((x) => ({ label: monthLabel(x.m).split(" ")[0]!, value: x.sum, display: taka(x.sum) }))} />
        </Card>
      )}
      {showEnrollment && (
        <Card title="Students by program" description="Active students this semester" actions={<Link href="/students" className="text-xs font-medium text-accent hover:underline">All students</Link>}>
          <Bars
            rows={db.programs.map((p) => {
              const n = active.filter((s) => s.programId === p.id).length;
              return { label: p.code, value: n, display: String(n), sub: `${pct(n, active.length)}%` };
            })}
          />
        </Card>
      )}
    </div>
  );
}

// ── Today ────────────────────────────────────────────────────────────────

function Today({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const today = todayDhaka();
  const wd = weekday(today);
  const now = nowHHMM();
  const classes = wd ? db.routine.filter((r) => r.day === wd).sort((a, b) => a.start.localeCompare(b.start)) : [];
  const running = classes.filter((c) => c.start <= now && now < c.end);
  const upcoming = classes.filter((c) => c.start > now).slice(0, 3);
  const exam = db.exams.filter((e) => e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const days = exam ? Math.round((Date.parse(`${exam.startDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
  const onLeave = db.leaves.filter((l) => l.status === "APPROVED" && l.person.type !== "STUDENT" && l.from <= today && today <= l.to).length;
  if (!can("academics.read") && !can("dashboard.view")) return null;

  const slot = (c: (typeof classes)[number], live: boolean) => (
    <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
      <span className={cx("w-12 shrink-0 text-xs tabular-nums", live ? "font-semibold text-success" : "text-muted")}>{c.start}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {lookup(db.courses, c.courseId)?.code} · {lookup(db.sections, c.sectionId)?.name}
        </span>
        <span className="block truncate text-xs text-muted">
          {lookup(db.teachers, c.teacherId)?.name ?? "No teacher"} · {c.room}
        </span>
      </span>
      {live && <Badge tone="success" dot>Now</Badge>}
    </li>
  );

  return (
    <Card title="Today" description={wd ? `${WEEKDAYS.find((w) => w.key === wd)?.label} · ${classes.length} classes` : "Friday: weekly holiday"} actions={<Link href="/routine" className="text-xs font-medium text-accent hover:underline">Routine</Link>}>
      {running.length + upcoming.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{wd ? "No more classes today." : "No classes on Friday."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {running.map((c) => slot(c, true))}
          {upcoming.map((c) => slot(c, false))}
        </ul>
      )}
      <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-sm">
        <div className="px-5 py-3">
          <p className="text-xs text-subtle">Next exam</p>
          <p className="truncate font-medium">{exam ? exam.name.replace(" Examination", "") : "—"}</p>
          {days !== null && <p className="text-xs text-muted">{days <= 0 ? "under way" : `in ${days} day${days === 1 ? "" : "s"}`}</p>}
        </div>
        <div className="px-5 py-3">
          <p className="text-xs text-subtle">Staff on leave</p>
          <p className="font-medium tabular-nums">{onLeave}</p>
          <p className="text-xs text-muted">today</p>
        </div>
      </div>
    </Card>
  );
}

// ── Notices & activity ───────────────────────────────────────────────────

function NoticeBoard({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const pinned = db.notices.filter((n) => n.pinned && (!n.expiresOn || n.expiresOn >= today)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <Card title="Notice board" description="Pinned announcements" actions={<Link href="/notices" className="text-xs font-medium text-accent hover:underline">All notices</Link>}>
      {pinned.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No pinned notices.</p>
      ) : (
        <ul className="divide-y divide-border">
          {pinned.slice(0, 3).map((n) => (
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

function Activity({ data }: { data: DashboardSummary }) {
  const items = data.recentActivity.slice(0, 6);
  return (
    <Card title="Recent activity" description="Sign-ins and account changes" actions={<Link href="/audit-logs" className="text-xs font-medium text-accent hover:underline">Audit log</Link>}>
      {items.length === 0 ? (
        <EmptyState icon="activity" title="No activity yet" />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar name={a.actorName ?? "System"} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{a.actorName ?? "System"}</span> <span className="text-muted">{describe(a.action)}</span>
              </p>
              <span className="shrink-0 text-xs text-subtle">{timeAgo(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** `campus.created` → "added a campus". */
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
