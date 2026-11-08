"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { attendanceStats, downloadCsv, lookup, MIN_ATTENDANCE, newId, nowIso, onLeave, todayDhaka, WEEKDAYS } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { AttendanceMark, DemoDb, Weekday } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, Progress, Tabs, Textarea, Toolbar } from "@/components/demo";
import { StudentProfile } from "@/components/students";
import { Avatar, Badge, Button, Card, cx, EmptyState, Field, FormActions, formatDate, Modal, PageHeader, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

const weekdayOf = (iso: string): Weekday | null =>
  (["SUN", "MON", "TUE", "WED", "THU", null, "SAT"] as const)[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? null;

export default function AttendancePage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [tab, setTab] = useState<"take" | "report" | "log" | "corrections">(can("attendance.take") ? "take" : "report");
  const [profile, setProfile] = useState<string | null>(null);

  return (
    <>
      <PageHeader eyebrow="Academic" title="Attendance" description={`Take attendance class by class. Students below ${MIN_ATTENDANCE}% are flagged before the final exam.`} actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Summary db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[...(can("attendance.take") ? [{ key: "take" as const, label: "Take attendance" }] : []), ...(can("attendance.read") ? [{ key: "report" as const, label: "Student report" }, { key: "log" as const, label: "Class log" }, { key: "corrections" as const, label: "Corrections", count: db.corrections.filter((c) => c.status === "PENDING").length }] : [])]}
          />
          {tab === "take" && <TakeAttendance db={db} />}
          {tab === "report" && <Report db={db} onOpen={setProfile} />}
          {tab === "log" && <ClassLog db={db} />}
          {tab === "corrections" && <Corrections db={db} />}
        </>
      )}
      <StudentProfile studentId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

function Summary({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const wd = weekdayOf(today);
  const scheduled = wd ? db.routine.filter((r) => r.day === wd).length : 0;
  const marked = db.attendance.filter((a) => a.date === today).length;
  const active = db.students.filter((s) => s.status === "ACTIVE" && s.sectionId);
  const percents = active.map((s) => attendanceStats(db.attendance.filter((a) => a.sectionId === s.sectionId), s.id).percent).filter((p): p is number => p !== null);
  const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Classes today" value={wd ? scheduled : "Friday"} sub={wd ? undefined : "weekend"} icon="calendar" />
      <StatCard label="Marked today" value={marked} sub={scheduled ? `of ${scheduled}` : undefined} icon="check" />
      <StatCard label="Average attendance" value={`${avg}%`} icon="chart" />
      <StatCard label={`Below ${MIN_ATTENDANCE}%`} value={percents.filter((p) => p < MIN_ATTENDANCE).length} sub="students" icon="alert" />
    </div>
  );
}

function TakeAttendance({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  // Submitted attendance is locked for teachers; the department (academics.manage)
  // can edit, and every change after the first save is kept as an audit trail.
  const canEdit = can("academics.manage");
  const [reason, setReason] = useState("");
  const [correcting, setCorrecting] = useState<{ studentId: string; from: AttendanceMark } | null>(null);
  const today = todayDhaka();
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const section = lookup(db.sections, sectionId);
  const [courseId, setCourseId] = useState(section?.courses[0]?.courseId ?? "");
  const [date, setDate] = useState(today);
  const existing = db.attendance.find((a) => a.sectionId === sectionId && a.courseId === courseId && a.date === date);
  const roster = useMemo(() => db.students.filter((s) => s.sectionId === sectionId && s.status === "ACTIVE").sort((a, b) => a.studentId.localeCompare(b.studentId)), [db.students, sectionId]);
  const [marks, setMarks] = useState<Record<string, AttendanceMark> | null>(null);
  const [loadedKey, setLoadedKey] = useState("");

  // Reset the working copy whenever the class or date changes.
  const key = `${sectionId}|${courseId}|${date}|${existing?.id ?? ""}`;
  if (key !== loadedKey) {
    setLoadedKey(key);
    setMarks(existing ? { ...existing.marks } : Object.fromEntries(roster.map((s) => [s.id, "P" as AttendanceMark])));
  }
  const current = marks ?? {};
  const wd = weekdayOf(date);
  const scheduledDays = db.routine.filter((r) => r.sectionId === sectionId && r.courseId === courseId).map((r) => r.day);
  const counts = { P: 0, L: 0, A: 0 };
  roster.forEach((s) => counts[current[s.id] ?? "P"]++);
  const locked = !!existing && !canEdit;
  const changed = existing ? roster.filter((s) => (existing.marks[s.id] ?? "P") !== (current[s.id] ?? "P")) : [];

  function save() {
    if (date > today) return toast("You can't take attendance for a future date", "error");
    if (!wd) return toast("Friday is a weekly holiday", "error");
    if (locked) return;
    if (existing && !changed.length) return toast("Nothing changed", "error");
    if (existing && reason.trim().length < 5) return toast("Give a reason for changing submitted attendance", "error");
    const filled = Object.fromEntries(roster.map((s) => [s.id, current[s.id] ?? "P"]));
    update((d) => {
      const sheet = d.attendance.find((a) => a.sectionId === sectionId && a.courseId === courseId && a.date === date);
      if (sheet) {
        sheet.edits = [...(sheet.edits ?? []), ...changed.map((s) => ({ at: nowIso(), by: actor, studentId: s.id, from: sheet.marks[s.id] ?? ("P" as AttendanceMark), to: filled[s.id]!, reason: reason.trim() }))];
        sheet.marks = filled;
      } else d.attendance.push({ id: newId(), sectionId, courseId, date, marks: filled, takenBy: actor, takenAt: nowIso() });
    });
    setReason("");
    toast(existing ? `${changed.length} change${changed.length === 1 ? "" : "s"} saved with an audit note` : `Attendance saved: ${counts.P} present, ${counts.L} late, ${counts.A} absent`);
  }

  return (
    <Card>
      <Toolbar>
        <FilterSelect
          label="Section"
          value={sectionId}
          onChange={(v) => {
            setSectionId(v);
            setCourseId(lookup(db.sections, v)?.courses[0]?.courseId ?? "");
          }}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Course" value={courseId} onChange={setCourseId}>
          {section?.courses.map((c) => {
            const course = lookup(db.courses, c.courseId)!;
            return (
              <option key={c.courseId} value={c.courseId}>
                {course.code} · {course.title}
              </option>
            );
          })}
        </FilterSelect>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Date" className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm" />
        <span className="text-xs text-muted">
          Scheduled {scheduledDays.length ? scheduledDays.map((d) => WEEKDAYS.find((w) => w.key === d)?.label.slice(0, 3)).join(", ") : "—"}
          {wd && scheduledDays.length > 0 && !scheduledDays.includes(wd) && <span className="text-warning"> · not on this day (make-up class?)</span>}
          {!wd && <span className="text-danger"> · Friday</span>}
        </span>
      </Toolbar>
      {existing && (
        <p className="border-b border-border bg-info/8 px-5 py-2 text-xs text-info">
          Submitted by {existing.takenBy} on {formatDate(existing.takenAt, true)}.{" "}
          {locked ? "It's locked: use Request correction on a student to fix a mistake; the department approves it." : "Changes need a reason and are kept in the audit trail."}
          {!!existing.edits?.length && ` ${existing.edits.length} change${existing.edits.length === 1 ? "" : "s"} recorded.`}
        </p>
      )}
      {roster.length === 0 ? (
        <EmptyState icon="users" title="No active students in this section" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-sm">
            <Badge tone="success">{counts.P} present</Badge>
            <Badge tone="warning">{counts.L} late</Badge>
            <Badge tone="danger">{counts.A} absent</Badge>
            <div className={cx("ml-auto flex gap-2", locked && "hidden")}>
              <Button size="sm" variant="ghost" onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.id, "P" as AttendanceMark])))}>
                All present
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.id, "A" as AttendanceMark])))}>
                All absent
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {roster.map((s, i) => {
              const mark = current[s.id] ?? "P";
              const pct = attendanceStats(db.attendance.filter((a) => a.sectionId === sectionId && a.courseId === courseId), s.id).percent;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="w-6 text-right text-xs text-subtle tabular-nums">{i + 1}</span>
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {s.studentId}
                      {pct !== null && <span className={cx("ml-2 font-sans", pct < MIN_ATTENDANCE && "text-danger")}>{pct}% so far</span>}
                      {onLeave(db, { type: "STUDENT", id: s.id }, date) && <span className="ml-2 font-sans font-medium text-warning">On approved leave</span>}
                      {existing && db.corrections.some((c) => c.sheetId === existing.id && c.studentId === s.id && c.status === "PENDING") && <span className="ml-2 font-sans font-medium text-accent">Correction pending</span>}
                    </p>
                  </div>
                  {locked && !db.corrections.some((c) => c.sheetId === existing!.id && c.studentId === s.id && c.status === "PENDING") && (
                    <Button size="sm" variant="ghost" onClick={() => setCorrecting({ studentId: s.id, from: mark })}>
                      Request correction
                    </Button>
                  )}
                  <div className="flex overflow-hidden rounded-lg border border-border-strong" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                    {(["P", "L", "A"] as const).map((m) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={mark === m}
                        disabled={locked}
                        onClick={() => setMarks({ ...current, [s.id]: m })}
                        className={cx(
                          "w-20 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                          mark === m ? (m === "P" ? "bg-success text-white" : m === "L" ? "bg-warning text-white" : "bg-danger text-white") : "text-muted hover:bg-surface-2",
                        )}
                      >
                        {m === "P" ? "Present" : m === "L" ? "Late" : "Absent"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {!locked && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              {existing && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={changed.length ? `Reason for ${changed.length} change${changed.length === 1 ? "" : "s"} (required)` : "Change a mark to edit"}
                  aria-label="Reason for change"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-2/60 px-3 text-sm focus:border-accent focus:outline-none"
                />
              )}
              <Button onClick={save} icon="check">
                {existing ? "Save changes" : "Submit attendance"}
              </Button>
            </div>
          )}
        </>
      )}
      <Modal open={!!correcting} onClose={() => setCorrecting(null)} title="Request a correction" description="Goes to the department for approval. The change and its reason are recorded.">
        {correcting && existing && (
          <CorrectionForm
            from={correcting.from}
            studentName={lookup(db.students, correcting.studentId)?.name ?? ""}
            onCancel={() => setCorrecting(null)}
            onSubmit={(to, why) => {
              update((d) => {
                d.corrections.push({ id: newId(), sheetId: existing.id, studentId: correcting.studentId, from: correcting.from, to, reason: why, requestedBy: actor, requestedAt: nowIso(), status: "PENDING", decidedBy: null, decidedAt: null });
              });
              toast("Correction request sent to the department");
              setCorrecting(null);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}

const MARK_LABEL: Record<AttendanceMark, string> = { P: "Present", L: "Late", A: "Absent" };

function CorrectionForm({ from, studentName, onSubmit, onCancel }: { from: AttendanceMark; studentName: string; onSubmit: (to: AttendanceMark, reason: string) => void; onCancel: () => void }) {
  const [to, setTo] = useState<AttendanceMark>(from === "P" ? "A" : "P");
  const [why, setWhy] = useState("");
  return (
    <div className="grid gap-4">
      <p className="text-sm">
        {studentName} is marked <span className="font-medium">{MARK_LABEL[from]}</span>.
      </p>
      <Field label="Should be">
        <Select value={to} onChange={(e) => setTo(e.target.value as AttendanceMark)}>
          {(["P", "L", "A"] as const)
            .filter((m) => m !== from)
            .map((m) => (
              <option key={m} value={m}>
                {MARK_LABEL[m]}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Reason">
        <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. Marked absent by mistake during roll call" />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={why.trim().length < 5} onClick={() => onSubmit(to, why.trim())}>
          Send request
        </Button>
      </FormActions>
    </div>
  );
}

function Corrections({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const canDecide = can("academics.manage");
  const rows = [...db.corrections].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.requestedAt.localeCompare(a.requestedAt));
  const decide = (id: string, approve: boolean) => {
    update((d) => {
      const c = d.corrections.find((x) => x.id === id)!;
      Object.assign(c, { status: approve ? "APPROVED" : "REJECTED", decidedBy: actor, decidedAt: nowIso() });
      if (approve) {
        const sheet = d.attendance.find((a) => a.id === c.sheetId);
        if (sheet) {
          sheet.marks[c.studentId] = c.to;
          sheet.edits = [...(sheet.edits ?? []), { at: nowIso(), by: actor, studentId: c.studentId, from: c.from, to: c.to, reason: `Correction requested by ${c.requestedBy}: ${c.reason}` }];
        }
      }
    });
    toast(approve ? "Correction applied and recorded" : "Correction rejected");
  };
  return (
    <Card>
      <Table head={["Class", "Student", "Change", "Reason", "Status", ""]} empty={!rows.length && <EmptyState icon="check" title="No correction requests" />}>
        {rows.map((c) => {
          const sheet = lookup(db.attendance, c.sheetId);
          return (
            <Tr key={c.id}>
              <Td>
                <p className="font-medium">
                  {lookup(db.sections, sheet?.sectionId)?.name} · {lookup(db.courses, sheet?.courseId)?.code}
                </p>
                <p className="text-xs text-muted">{sheet ? formatDate(sheet.date) : "—"}</p>
              </Td>
              <Td>{lookup(db.students, c.studentId)?.name}</Td>
              <Td className="whitespace-nowrap">
                {MARK_LABEL[c.from]} → <span className="font-medium">{MARK_LABEL[c.to]}</span>
              </Td>
              <Td className="max-w-72 text-xs text-muted">
                {c.reason}
                <span className="block text-subtle">by {c.requestedBy}</span>
              </Td>
              <Td>
                <Badge tone={c.status === "PENDING" ? "warning" : c.status === "APPROVED" ? "success" : "danger"} dot>
                  {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                </Badge>
              </Td>
              <Td className="text-right whitespace-nowrap">
                {c.status === "PENDING" && canDecide && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => decide(c.id, false)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => decide(c.id, true)}>
                      Approve
                    </Button>
                  </>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
    </Card>
  );
}

function Report({ db, onOpen }: { db: DemoDb; onOpen: (id: string) => void }) {
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [onlyLow, setOnlyLow] = useState(false);
  const section = lookup(db.sections, sectionId);
  const sheets = db.attendance.filter((a) => a.sectionId === sectionId);
  const students = db.students.filter((s) => s.sectionId === sectionId).sort((a, b) => a.studentId.localeCompare(b.studentId));
  const rows = students
    .map((s) => ({ s, overall: attendanceStats(sheets, s.id), perCourse: section?.courses.map((c) => attendanceStats(sheets.filter((x) => x.courseId === c.courseId), s.id).percent) ?? [] }))
    .filter((r) => !onlyLow || (r.overall.percent ?? 100) < MIN_ATTENDANCE);
  const codes = section?.courses.map((c) => lookup(db.courses, c.courseId)?.code ?? "") ?? [];

  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Only below {MIN_ATTENDANCE}%
        </label>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() =>
            downloadCsv(`attendance-${section?.name}-${todayDhaka()}.csv`, [
              ["Student ID", "Name", ...codes, "Classes", "Present", "Late", "Absent", "Overall %"],
              ...rows.map((r) => [r.s.studentId, r.s.name, ...r.perCourse.map((p) => p ?? ""), r.overall.total, r.overall.present, r.overall.late, r.overall.absent, r.overall.percent ?? ""]),
            ])
          }
        >
          Export CSV
        </Button>
      </Toolbar>
      <Table head={["Student", ...codes, "Overall"]} empty={!rows.length && <EmptyState icon="check" title={onlyLow ? `Everyone is at ${MIN_ATTENDANCE}% or above` : "No students"} />}>
        {rows.map(({ s, overall, perCourse }) => (
          <Tr key={s.id}>
            <Td>
              <button onClick={() => onOpen(s.id)} className="text-left">
                <span className="block font-medium hover:text-accent">{s.name}</span>
                <span className="block font-mono text-xs text-muted">{s.studentId}</span>
              </button>
            </Td>
            {perCourse.map((p, i) => (
              <Td key={i} className={cx("tabular-nums", (p ?? 100) < MIN_ATTENDANCE && "text-danger")}>
                {p ?? "—"}
                {p !== null && "%"}
              </Td>
            ))}
            <Td className="min-w-40">
              <div className="flex items-center gap-2">
                <Progress value={overall.percent ?? 0} tone={(overall.percent ?? 100) < MIN_ATTENDANCE ? "danger" : "success"} />
                <span className={cx("w-10 text-right text-sm font-medium tabular-nums", (overall.percent ?? 100) < MIN_ATTENDANCE && "text-danger")}>{overall.percent ?? "—"}%</span>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
    </Card>
  );
}

function ClassLog({ db }: { db: DemoDb }) {
  const [sectionId, setSectionId] = useState("");
  const sheets = db.attendance.filter((a) => !sectionId || a.sectionId === sectionId).sort((a, b) => b.date.localeCompare(a.date) || a.sectionId.localeCompare(b.sectionId));
  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
          <option value="">All sections</option>
          {db.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{sheets.length} classes recorded</span>
      </Toolbar>
      <Table head={["Date", "Section", "Course", "Present", "Late", "Absent", "Taken by"]} empty={!sheets.length && <EmptyState icon="calendar" title="No attendance recorded yet" />}>
        {sheets.slice(0, 60).map((a) => {
          const values = Object.values(a.marks);
          return (
            <Tr key={a.id}>
              <Td className="whitespace-nowrap">{formatDate(a.date)}</Td>
              <Td>{lookup(db.sections, a.sectionId)?.name}</Td>
              <Td className="font-mono text-xs">{lookup(db.courses, a.courseId)?.code}</Td>
              <Td className="text-success tabular-nums">{values.filter((m) => m === "P").length}</Td>
              <Td className="text-warning tabular-nums">{values.filter((m) => m === "L").length}</Td>
              <Td className="text-danger tabular-nums">{values.filter((m) => m === "A").length}</Td>
              <Td className="text-muted">{a.takenBy}</Td>
            </Tr>
          );
        })}
      </Table>
      {sheets.length > 60 && <p className="border-t border-border px-5 py-3 text-xs text-muted">Showing the latest 60. Filter by section to see more.</p>}
    </Card>
  );
}
