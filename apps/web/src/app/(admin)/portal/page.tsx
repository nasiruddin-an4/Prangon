"use client";

import Link from "next/link";
import { attendanceStats, fineFor, formatGpa, invoiceStatus, invoiceTotals, lookup, MIN_ATTENDANCE, semesterResult, taka, todayDhaka, WEEKDAYS } from "@/lib/demo/logic";
import type { DemoDb, Student } from "@/lib/demo/types";
import { certificateStage, examEligibility, noticesFor, studentDue } from "@/lib/demo/workflows";
import { Icon, type IconName } from "@/components/icons";
import { PortalPage, StudentBanner } from "@/components/portal";
import { Card, formatDate, StatCard, timeAgo } from "@/components/ui";

const weekday = (iso: string) => (["SUN", "MON", "TUE", "WED", "THU", null, "SAT"] as const)[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? null;

export default function PortalHome() {
  return <PortalPage title="My dashboard">{({ db, student }) => <Home db={db} student={student} />}</PortalPage>;
}

function Home({ db, student }: { db: DemoDb; student: Student }) {
  const today = todayDhaka();
  const section = lookup(db.sections, student.sectionId);
  const attendance = attendanceStats(db.attendance.filter((a) => a.sectionId === student.sectionId), student.id).percent;
  const published = !!section && db.publications.some((p) => p.sectionId === section.id);
  const result = section ? semesterResult(db, section.id, student.id) : null;
  const due = studentDue(db, student.id);
  const wd = weekday(today);
  const classes = wd ? db.routine.filter((r) => r.sectionId === student.sectionId && r.day === wd).sort((a, b) => a.start.localeCompare(b.start)) : [];

  // Things the student should act on, most urgent first.
  const todo: { icon: IconName; text: string; href: string; urgent?: boolean }[] = [];
  for (const inv of db.invoices.filter((i) => i.studentId === student.id)) {
    const t = invoiceTotals(inv, db.payments);
    if (!t.due) continue;
    const overdue = invoiceStatus(inv, db.payments, today) === "OVERDUE";
    todo.push({ icon: "wallet", text: `${inv.kind === "FINE" ? "Fine" : inv.kind === "CERTIFICATE" ? "Certificate fee" : "Semester fee"} ${taka(t.due)} ${overdue ? "overdue since" : "due"} ${formatDate(inv.dueDate)}`, href: "/portal/accounts", urgent: overdue });
  }
  for (const loan of db.bookIssues.filter((i) => !i.returnedOn && i.borrower.type === "STUDENT" && i.borrower.id === student.id)) {
    const late = loan.dueOn < today;
    todo.push({ icon: "bookOpen", text: `Return “${lookup(db.books, loan.bookId)?.title}” ${late ? `— overdue, fine so far ${taka(fineFor(loan, today))}` : `by ${formatDate(loan.dueOn)}`}`, href: "/portal/library", urgent: late });
  }
  const elig = examEligibility(db, student, today);
  if (!elig.eligible) todo.push({ icon: "alert", text: `Not yet eligible for exams: ${elig.reasons.join("; ")}`, href: "/portal/exams", urgent: true });
  for (const r of db.certificateRequests.filter((x) => x.studentId === student.id)) {
    const stage = certificateStage(db, r);
    if (stage === "AWAITING_FEE") todo.push({ icon: "award", text: `Pay the certificate fee for ${r.requestNo} so it can be issued`, href: "/portal/accounts" });
  }
  const openTickets = db.tickets.filter((t) => t.studentId === student.id && t.status !== "CLOSED" && t.status !== "RESOLVED").length;
  const notices = noticesFor(db, student, today).slice(0, 4);

  return (
    <>
      <StudentBanner db={db} student={student} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current semester" value={section ? (lookup(db.semesters, section.semesterId)?.name ?? "—") : "—"} sub={section?.name} icon="calendar" />
        <StatCard label="Attendance" value={attendance === null ? "—" : `${attendance}%`} sub={attendance !== null && attendance < MIN_ATTENDANCE ? `below ${MIN_ATTENDANCE}%` : undefined} icon="check" />
        <StatCard label="Semester GPA" value={published && result?.complete ? formatGpa(result.gpa) : "—"} sub={published ? undefined : "not published yet"} icon="graduation" />
        <StatCard label="Outstanding" value={taka(due)} icon="wallet" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Today's classes" description={wd ? WEEKDAYS.find((w) => w.key === wd)?.label : "Friday: weekly holiday"} actions={<Link href="/portal/academics" className="text-xs font-medium text-accent hover:underline">Weekly routine</Link>}>
            {classes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No classes today.</p>
            ) : (
              <ul className="divide-y divide-border">
                {classes.map((c) => {
                  const course = lookup(db.courses, c.courseId);
                  return (
                    <li key={c.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <span className="w-24 shrink-0 font-medium tabular-nums">
                        {c.start}–{c.end}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {course?.code} · {course?.title}
                        </span>
                        <span className="block text-xs text-muted">{lookup(db.teachers, c.teacherId)?.name ?? "Teacher not assigned"}</span>
                      </span>
                      <span className="font-mono text-xs text-muted">{c.room}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="To do" description={todo.length ? `${todo.length} item${todo.length === 1 ? "" : "s"} need your attention` : "You're all caught up"}>
            {todo.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nothing pending.</p>
            ) : (
              <ul className="divide-y divide-border">
                {todo
                  .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
                  .map((t, i) => (
                    <li key={i}>
                      <Link href={t.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2/60">
                        <Icon name={t.icon} className={t.urgent ? "size-4 text-danger" : "size-4 text-subtle"} />
                        <span className={t.urgent ? "flex-1 text-danger" : "flex-1"}>{t.text}</span>
                        <Icon name="chevronRight" className="size-4 text-subtle" />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {openTickets > 0 && <p className="border-t border-border px-5 py-2.5 text-xs text-muted">{openTickets} support request{openTickets === 1 ? "" : "s"} still open.</p>}
          </Card>
        </div>
        <Card title="Notices" actions={<Link href="/portal/notices" className="text-xs font-medium text-accent hover:underline">All notices</Link>}>
          {notices.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No notices.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notices.map((n) => (
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
      </div>
    </>
  );
}
