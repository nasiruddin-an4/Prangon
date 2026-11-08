"use client";

import { useState, type ReactNode } from "react";
import { attendanceStats, downloadCsv, formatGpa, invoiceStatus, invoiceTotals, lookup, methodLabel, MIN_ATTENDANCE, PAYMENT_METHODS, semesterResult, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { ApplicationStatus, DemoDb } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, Tabs } from "@/components/demo";
import { Button, Card, cx, formatDate, PageHeader, StatCard, Table, Td, Tr } from "@/components/ui";

type Tab = "enrollment" | "attendance" | "results" | "finance" | "admissions";

export default function ReportsPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("enrollment");
  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports" description="Enrollment, attendance, results, fee collection and admissions at a glance. Every report exports to CSV for Excel." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "enrollment", label: "Enrollment" },
              { key: "attendance", label: "Attendance" },
              { key: "results", label: "Results" },
              { key: "finance", label: "Fee collection" },
              { key: "admissions", label: "Admissions" },
            ]}
          />
          {tab === "enrollment" && <Enrollment db={db} />}
          {tab === "attendance" && <Attendance db={db} />}
          {tab === "results" && <Results db={db} />}
          {tab === "finance" && <Finance db={db} />}
          {tab === "admissions" && <Admissions db={db} />}
        </>
      )}
    </>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

interface BarRow {
  label: string;
  value: number;
  /** Text shown at the end of the bar (defaults to the value). */
  display?: string;
  sub?: string;
  /** Marks a row that needs attention; drawn with a label, never colour alone. */
  flag?: string;
}

/**
 * Single-series horizontal bars: one hue, thin marks, values as text in text
 * colours, and a hover title with the exact figure. The rows double as the
 * table view.
 */
function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3 p-5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.display ?? r.value}${r.sub ? ` (${r.sub})` : ""}`} className="grid grid-cols-[minmax(7rem,30%)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-r-[4px] bg-surface-3/70">
            <span className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%` }} />
          </span>
          <span className="min-w-16 text-right font-medium tabular-nums">
            {r.display ?? r.value.toLocaleString("en-IN")}
            {r.sub && <span className="ml-1.5 text-xs font-normal text-subtle">{r.sub}</span>}
            {r.flag && <span className="ml-1.5 text-xs font-normal text-danger">{r.flag}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReportCard({ title, description, csv, children, className }: { title: string; description?: string; csv?: () => void; children: ReactNode; className?: string }) {
  return (
    <Card
      title={title}
      description={description}
      className={className}
      actions={
        csv && (
          <Button size="sm" variant="secondary" onClick={csv}>
            Export CSV
          </Button>
        )
      }
    >
      {children}
    </Card>
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const file = (name: string) => `${name}-${todayDhaka()}.csv`;

// ── Enrollment ───────────────────────────────────────────────────────────

function Enrollment({ db }: { db: DemoDb }) {
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const byProgram = db.programs.map((p) => {
    const list = active.filter((s) => s.programId === p.id);
    return { p, total: list.length, female: list.filter((s) => s.gender === "FEMALE").length };
  });
  const divisions = [...new Set(active.map((s) => s.division ?? "Unknown"))].map((d) => ({ d, n: active.filter((s) => (s.division ?? "Unknown") === d).length })).sort((a, b) => b.n - a.n);
  const statuses = (["ACTIVE", "SUSPENDED", "GRADUATED", "DROPPED"] as const).map((st) => ({ st, n: db.students.filter((s) => s.status === st).length }));
  const female = active.filter((s) => s.gender === "FEMALE").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active students" value={active.length} icon="graduation" />
        <StatCard label="Female" value={`${pct(female, active.length)}%`} sub={`${female} students`} icon="users" />
        <StatCard label="Programs" value={db.programs.length} icon="layers" />
        <StatCard label="Home divisions" value={divisions.length} icon="mapPin" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard
          title="Students by program"
          description="Active students; female share alongside"
          csv={() => downloadCsv(file("enrollment-by-program"), [["Program", "Active students", "Female", "Female %"], ...byProgram.map((r) => [r.p.name, r.total, r.female, pct(r.female, r.total)])])}
        >
          <BarList rows={byProgram.map((r) => ({ label: r.p.code, value: r.total, sub: `${pct(r.female, r.total)}% female` }))} />
        </ReportCard>
        <ReportCard title="Home division" description="Where active students come from" csv={() => downloadCsv(file("enrollment-by-division"), [["Division", "Students"], ...divisions.map((r) => [r.d, r.n])])}>
          <BarList rows={divisions.map((r) => ({ label: r.d, value: r.n, sub: `${pct(r.n, active.length)}%` }))} />
        </ReportCard>
        <ReportCard title="Students by section" description="Current semester" csv={() => downloadCsv(file("enrollment-by-section"), [["Section", "Program", "Students"], ...db.sections.map((s) => [s.name, lookup(db.programs, s.programId)?.code, db.students.filter((x) => x.sectionId === s.id).length])])}>
          <BarList rows={db.sections.map((s) => ({ label: s.name, value: db.students.filter((x) => x.sectionId === s.id && x.status === "ACTIVE").length }))} />
        </ReportCard>
        <ReportCard title="Student status" description="All student records">
          <BarList rows={statuses.map((r) => ({ label: r.st.charAt(0) + r.st.slice(1).toLowerCase(), value: r.n }))} />
        </ReportCard>
      </div>
    </div>
  );
}

// ── Attendance ───────────────────────────────────────────────────────────

function Attendance({ db }: { db: DemoDb }) {
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const rows = sections.map((sec) => {
    const sheets = db.attendance.filter((a) => a.sectionId === sec.id);
    const percents = db.students
      .filter((s) => s.sectionId === sec.id && s.status === "ACTIVE")
      .map((s) => ({ s, p: attendanceStats(sheets, s.id).percent }))
      .filter((x): x is { s: (typeof db.students)[number]; p: number } => x.p !== null);
    const avg = percents.length ? Math.round(percents.reduce((a, x) => a + x.p, 0) / percents.length) : 0;
    return { sec, avg, classes: sheets.length, low: percents.filter((x) => x.p < MIN_ATTENDANCE) };
  });
  const lowList = rows.flatMap((r) => r.low.map((x) => ({ ...x, sec: r.sec }))).sort((a, b) => a.p - b.p);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Classes recorded" value={db.attendance.length} icon="calendar" />
        <StatCard label="Average attendance" value={`${rows.length ? Math.round(rows.reduce((a, r) => a + r.avg, 0) / rows.length) : 0}%`} icon="chart" />
        <StatCard label={`Below ${MIN_ATTENDANCE}%`} value={lowList.length} sub="students" icon="alert" />
        <StatCard label="Sections" value={sections.length} icon="users" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard
          title="Average attendance by section"
          description={`Students below ${MIN_ATTENDANCE}% can't sit the final exam`}
          csv={() => downloadCsv(file("attendance-by-section"), [["Section", "Classes recorded", "Average %", `Students below ${MIN_ATTENDANCE}%`], ...rows.map((r) => [r.sec.name, r.classes, r.avg, r.low.length])])}
        >
          <BarList max={100} rows={rows.map((r) => ({ label: r.sec.name, value: r.avg, display: `${r.avg}%`, flag: r.low.length ? `${r.low.length} below ${MIN_ATTENDANCE}%` : undefined }))} />
        </ReportCard>
        <ReportCard
          title={`Students below ${MIN_ATTENDANCE}%`}
          description="Lowest first: contact their guardians"
          csv={() =>
            downloadCsv(file("low-attendance"), [
              ["Student ID", "Name", "Section", "Attendance %", "Guardian", "Guardian mobile"],
              ...lowList.map((x) => {
                const g = lookup(db.guardians, x.s.guardianIds[0]);
                return [x.s.studentId, x.s.name, x.sec.name, x.p, g?.name, g?.phone];
              }),
            ])
          }
        >
          <Table head={["Student", "Section", "Attendance", "Guardian"]} empty={!lowList.length && <p className="px-5 py-6 text-sm text-muted">Everyone is at {MIN_ATTENDANCE}% or above.</p>}>
            {lowList.slice(0, 12).map((x) => {
              const g = lookup(db.guardians, x.s.guardianIds[0]);
              return (
                <Tr key={x.s.id}>
                  <Td>
                    <p className="font-medium">{x.s.name}</p>
                    <p className="font-mono text-xs text-muted">{x.s.studentId}</p>
                  </Td>
                  <Td className="text-muted">{x.sec.name}</Td>
                  <Td className="font-medium text-danger tabular-nums">{x.p}%</Td>
                  <Td className="text-xs text-muted">
                    {g?.name}
                    <br />
                    <span className="tabular-nums">{g?.phone}</span>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        </ReportCard>
      </div>
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────

function Results({ db }: { db: DemoDb }) {
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const bySection = sections.map((sec) => {
    const results = db.students.filter((s) => s.sectionId === sec.id && s.status !== "DROPPED").map((s) => semesterResult(db, sec.id, s.id)!);
    const complete = results.filter((r) => r.complete);
    return {
      sec,
      complete,
      total: results.length,
      avg: complete.length ? complete.reduce((a, r) => a + (r.gpa ?? 0), 0) / complete.length : null,
      pass: pct(complete.filter((r) => !r.failed).length, complete.length),
      published: db.publications.some((p) => p.sectionId === sec.id),
    };
  });
  // Grade distribution across every complete course result this semester.
  const letters = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F"];
  const grades = new Map(letters.map((l) => [l, 0]));
  bySection.forEach((x) => x.complete.forEach((r) => r.rows.forEach((row) => row.complete && grades.set(row.letter, (grades.get(row.letter) ?? 0) + 1))));
  const totalGrades = [...grades.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ReportCard
        title="Average GPA by section"
        description="Sections where every mark is in; others show how many results are complete"
        csv={() => downloadCsv(file("results-by-section"), [["Section", "Students", "Complete results", "Average GPA", "Pass rate %", "Published"], ...bySection.map((x) => [x.sec.name, x.total, x.complete.length, x.avg === null ? "" : x.avg.toFixed(2), x.complete.length ? x.pass : "", x.published ? "Yes" : "No"])])}
      >
        <BarList
          max={4}
          rows={bySection.map((x) => ({
            label: x.sec.name,
            value: x.avg ?? 0,
            display: x.avg === null ? "—" : formatGpa(x.avg),
            sub: x.avg === null ? `${x.complete.length}/${x.total} complete` : `${x.pass}% pass${x.published ? " · published" : ""}`,
          }))}
        />
      </ReportCard>
      <ReportCard title="Grade distribution" description={`${totalGrades} course results with all marks in`} csv={() => downloadCsv(file("grade-distribution"), [["Grade", "Count", "%"], ...letters.map((l) => [l, grades.get(l) ?? 0, pct(grades.get(l) ?? 0, totalGrades)])])}>
        {totalGrades === 0 ? <p className="px-5 py-6 text-sm text-muted">No complete results yet. Final marks appear here once entered.</p> : <BarList rows={letters.map((l) => ({ label: l, value: grades.get(l) ?? 0, sub: `${pct(grades.get(l) ?? 0, totalGrades)}%`, flag: l === "F" && (grades.get(l) ?? 0) > 0 ? "fail" : undefined }))} />}
      </ReportCard>
    </div>
  );
}

// ── Finance ──────────────────────────────────────────────────────────────

function Finance({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const withTotals = db.invoices.map((inv) => ({ inv, t: invoiceTotals(inv, db.payments), status: invoiceStatus(inv, db.payments, today), student: lookup(db.students, inv.studentId) }));
  const byProgram = db.programs.map((p) => {
    const list = withTotals.filter((x) => x.student?.programId === p.id);
    const billed = list.reduce((s, x) => s + x.t.net, 0);
    const paid = list.reduce((s, x) => s + x.t.paid, 0);
    return { p, billed, paid, due: billed - paid };
  });
  const months = [...new Set(db.payments.map((p) => p.paidAt.slice(0, 7)))].sort();
  const byMonth = months.map((m) => ({ m, sum: db.payments.filter((p) => p.paidAt.startsWith(m)).reduce((s, p) => s + p.amount, 0) }));
  const byMethod = PAYMENT_METHODS.map((m) => ({ m, sum: db.payments.filter((p) => p.method === m.key).reduce((s, p) => s + p.amount, 0) }));
  const collected = db.payments.reduce((s, p) => s + p.amount, 0);
  const defaulters = withTotals.filter((x) => x.status === "OVERDUE").sort((a, b) => b.t.due - a.t.due);
  const billed = byProgram.reduce((s, x) => s + x.billed, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed" value={taka(billed)} icon="fileText" />
        <StatCard label="Collected" value={taka(collected)} sub={`${pct(collected, billed)}%`} icon="wallet" />
        <StatCard label="Outstanding" value={taka(billed - collected)} icon="clock" />
        <StatCard label="Overdue" value={defaulters.length} sub={taka(defaulters.reduce((s, x) => s + x.t.due, 0))} icon="alert" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard
          title="Collection by program"
          description="Share of the billed amount collected"
          csv={() => downloadCsv(file("collection-by-program"), [["Program", "Billed", "Collected", "Outstanding", "Collected %"], ...byProgram.map((x) => [x.p.name, x.billed, x.paid, x.due, pct(x.paid, x.billed)])])}
        >
          <BarList max={100} rows={byProgram.map((x) => ({ label: x.p.code, value: pct(x.paid, x.billed), display: `${pct(x.paid, x.billed)}%`, sub: `${taka(x.due)} due` }))} />
        </ReportCard>
        <ReportCard title="Collection by month" description="Payments received" csv={() => downloadCsv(file("collection-by-month"), [["Month", "Collected"], ...byMonth.map((x) => [x.m, x.sum])])}>
          <BarList rows={byMonth.map((x) => ({ label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${x.m}-01T00:00:00Z`)), value: x.sum, display: taka(x.sum) }))} />
        </ReportCard>
        <ReportCard title="By payment method" description="Mobile banking vs cash vs bank" csv={() => downloadCsv(file("collection-by-method"), [["Method", "Collected", "%"], ...byMethod.map((x) => [x.m.label, x.sum, pct(x.sum, collected)])])}>
          <BarList rows={byMethod.map((x) => ({ label: methodLabel(x.m.key), value: x.sum, display: taka(x.sum), sub: `${pct(x.sum, collected)}%` }))} />
        </ReportCard>
        <ReportCard
          title="Overdue invoices"
          description="Largest dues first"
          csv={() =>
            downloadCsv(file("overdue"), [
              ["Invoice", "Student ID", "Student", "Due", "Due date", "Guardian mobile"],
              ...defaulters.map((x) => [x.inv.invoiceNo, x.student?.studentId, x.student?.name, x.t.due, x.inv.dueDate, lookup(db.guardians, x.student?.guardianIds[0])?.phone]),
            ])
          }
        >
          <Table head={["Student", "Due", "Since"]} empty={!defaulters.length && <p className="px-5 py-6 text-sm text-muted">No overdue invoices.</p>}>
            {defaulters.slice(0, 10).map((x) => (
              <Tr key={x.inv.id}>
                <Td>
                  <p className="font-medium">{x.student?.name}</p>
                  <p className="font-mono text-xs text-muted">{x.inv.invoiceNo}</p>
                </Td>
                <Td className="font-medium text-danger tabular-nums">{taka(x.t.due)}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(x.inv.dueDate)}</Td>
              </Tr>
            ))}
          </Table>
        </ReportCard>
      </div>
    </div>
  );
}

// ── Admissions ───────────────────────────────────────────────────────────

const FUNNEL: { key: ApplicationStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Applied" },
  { key: "UNDER_REVIEW", label: "Reviewed" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "ENROLLED", label: "Enrolled" },
];

function Admissions({ db }: { db: DemoDb }) {
  const apps = db.applications;
  // A later stage implies the earlier ones, so each step counts everyone who reached it.
  const reached = (key: ApplicationStatus | "ALL") => {
    if (key === "ALL") return apps.length;
    const order: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "ENROLLED"];
    const idx = order.indexOf(key);
    return apps.filter((a) => (a.status === "REJECTED" ? idx <= 1 : order.indexOf(a.status) >= idx)).length;
  };
  const byProgram = db.programs.map((p) => ({ p, n: apps.filter((a) => a.programId === p.id).length, accepted: apps.filter((a) => a.programId === p.id && (a.status === "ACCEPTED" || a.status === "ENROLLED")).length }));
  const scored = apps.filter((a) => a.testScore !== null);
  const avgHsc = apps.length ? apps.reduce((s, a) => s + a.hscGpa, 0) / apps.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Applications" value={apps.length} icon="clipboard" />
        <StatCard label="Acceptance rate" value={`${pct(apps.filter((a) => a.status === "ACCEPTED" || a.status === "ENROLLED").length, apps.filter((a) => a.decidedAt || a.status === "ENROLLED").length)}%`} sub="of decided" icon="check" />
        <StatCard label="Average HSC GPA" value={avgHsc.toFixed(2)} icon="graduation" />
        <StatCard label="Average test score" value={scored.length ? Math.round(scored.reduce((s, a) => s + (a.testScore ?? 0), 0) / scored.length) : "—"} icon="chart" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard title="Admission funnel" description="How many applicants reached each stage">
          <BarList rows={FUNNEL.map((f) => ({ label: f.label, value: reached(f.key), sub: `${pct(reached(f.key), apps.length)}%` }))} />
        </ReportCard>
        <ReportCard
          title="Applications by program"
          description="With accepted or enrolled alongside"
          csv={() => downloadCsv(file("applications-by-program"), [["Program", "Applications", "Accepted or enrolled"], ...byProgram.map((x) => [x.p.name, x.n, x.accepted])])}
        >
          <BarList rows={byProgram.map((x) => ({ label: x.p.code, value: x.n, sub: `${x.accepted} accepted` }))} />
        </ReportCard>
      </div>
      <p className={cx("text-xs text-subtle")}>Rejected applicants count as reviewed in the funnel.</p>
    </div>
  );
}
