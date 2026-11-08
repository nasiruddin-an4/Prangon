"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { grade, GRADE_SCALE, lookup, MARK_PARTS, newId, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Exam, ExamType, Mark } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, PrintButton, Tabs, Toolbar } from "@/components/demo";
import { AdmitCard } from "@/components/admit-card";
import { examEligibility } from "@/lib/demo/workflows";
import { Badge, Button, Card, cx, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

type Tab = "schedule" | "marks" | "admit" | "scale";
const TYPE_LABEL: Record<ExamType, string> = { CLASS_TEST: "Class test", MIDTERM: "Midterm", FINAL: "Final" };

export default function ExamsPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>(can("marks.enter") ? "marks" : "schedule");
  return (
    <>
      <PageHeader eyebrow="Academic" title="Exams & marks" description="Exam schedule and marks entry: attendance 10 · class test 20 · midterm 30 · final 40. Results and transcripts are on their own page." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Overview db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              ...(can("marks.enter") ? [{ key: "marks" as const, label: "Marks entry" }] : []),
              { key: "schedule", label: "Exam schedule", count: db.exams.length },
              ...(can("exams.manage") || can("results.publish") ? [{ key: "admit" as const, label: "Eligibility & admit cards" }] : []),
              { key: "scale", label: "Grading scale" },
            ]}
          />
          {tab === "schedule" && <Schedule db={db} />}
          {tab === "marks" && <MarksEntry db={db} />}
          {tab === "admit" && <Admit db={db} />}
          {tab === "scale" && <Scale />}
        </>
      )}
    </>
  );
}

function Overview({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const next = db.exams.filter((e) => e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const ongoingSections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const needed = ongoingSections.reduce((n, s) => n + s.courses.length * db.students.filter((x) => x.sectionId === s.id).length, 0);
  const finals = db.marks.filter((m) => m.final !== null && ongoingSections.some((s) => s.id === m.sectionId)).length;
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Next exam" value={next ? next.name.replace(" Examination", "") : "—"} sub={next ? formatDate(next.startDate) : undefined} icon="calendar" />
      <StatCard label="Final marks entered" value={`${needed ? Math.round((finals / needed) * 100) : 0}%`} icon="pencil" />
      <StatCard label="Results published" value={db.publications.length} sub={`of ${ongoingSections.length} sections`} icon="check" />
      <StatCard label="Courses this semester" value={new Set(ongoingSections.flatMap((s) => s.courses.map((c) => c.courseId))).size} icon="book" />
    </div>
  );
}

// ── Schedule ─────────────────────────────────────────────────────────────

function Schedule({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [editing, setEditing] = useState<Exam | "new" | null>(null);
  const today = todayDhaka();
  const manage = can("exams.manage");
  const item = editing === "new" ? null : editing;

  function submit(event: FormEvent<HTMLFormElement>, done: (e: string | null) => void) {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    if (!f.name || !f.startDate || !f.endDate) return done("Name and dates are required.");
    if (f.endDate < f.startDate) return done("The exam can't end before it starts.");
    const values = { name: f.name, type: f.type as ExamType, semesterId: f.semesterId!, startDate: f.startDate, endDate: f.endDate };
    update((d) => {
      if (item) Object.assign(d.exams.find((e) => e.id === item.id)!, values);
      else d.exams.push({ id: newId(), ...values });
    });
    toast(item ? "Exam updated" : `${values.name} scheduled`);
    setEditing(null);
  }

  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">Dates shown to students and guardians once the portals are live.</span>
        {manage && (
          <Button size="sm" icon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Schedule exam
          </Button>
        )}
      </Toolbar>
      <Table head={["Exam", "Type", "Semester", "Dates", "Status", ""]} empty={!db.exams.length && <EmptyState icon="calendar" title="No exams scheduled" />}>
        {[...db.exams]
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .map((e) => {
            const status = e.endDate < today ? "Done" : e.startDate <= today ? "Ongoing" : "Upcoming";
            return (
              <Tr key={e.id}>
                <Td className="font-medium">{e.name}</Td>
                <Td className="text-muted">{TYPE_LABEL[e.type]}</Td>
                <Td className="text-muted">{lookup(db.semesters, e.semesterId)?.name}</Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDate(e.startDate)} – {formatDate(e.endDate)}
                </Td>
                <Td>
                  <Badge tone={status === "Done" ? "neutral" : status === "Ongoing" ? "success" : "accent"} dot>
                    {status}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {manage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!window.confirm(`Delete ${e.name}?`)) return;
                          update((d) => {
                            d.exams = d.exams.filter((x) => x.id !== e.id);
                          });
                          toast("Exam deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Td>
              </Tr>
            );
          })}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? "Edit exam" : "Schedule exam"}>
        {editing !== null && <ExamForm db={db} exam={item} onSubmit={submit} onCancel={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function ExamForm({ db, exam, onSubmit, onCancel }: { db: DemoDb; exam: Exam | null; onSubmit: (e: FormEvent<HTMLFormElement>, done: (error: string | null) => void) => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => onSubmit(e, setError)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={exam?.name} required autoFocus placeholder="e.g. Midterm Examination" />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue={exam?.type ?? "MIDTERM"}>
          {(Object.keys(TYPE_LABEL) as ExamType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Semester">
        <Select name="semesterId" defaultValue={exam?.semesterId ?? db.semesters.find((s) => s.status === "ONGOING")?.id}>
          {db.semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Starts">
        <Input name="startDate" type="date" defaultValue={exam?.startDate} required />
      </Field>
      <Field label="Ends">
        <Input name="endDate" type="date" defaultValue={exam?.endDate} required />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </FormActions>
    </form>
  );
}

// ── Marks entry ──────────────────────────────────────────────────────────

type Draft = Record<string, Record<(typeof MARK_PARTS)[number]["key"], string>>;

function MarksEntry({ db }: { db: DemoDb }) {
  const { update } = useDemo();
  const toast = useToast();
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const section = lookup(db.sections, sectionId);
  const [courseId, setCourseId] = useState(section?.courses[0]?.courseId ?? "");
  const [draft, setDraft] = useState<Draft>({});
  const [loadedKey, setLoadedKey] = useState("");
  const published = db.publications.some((p) => p.sectionId === sectionId);
  const students = db.students.filter((s) => s.sectionId === sectionId && s.status !== "DROPPED").sort((a, b) => a.studentId.localeCompare(b.studentId));

  const key = `${sectionId}|${courseId}`;
  if (key !== loadedKey) {
    setLoadedKey(key);
    setDraft(
      Object.fromEntries(
        students.map((s) => {
          const m = db.marks.find((x) => x.sectionId === sectionId && x.courseId === courseId && x.studentId === s.id);
          return [s.id, Object.fromEntries(MARK_PARTS.map((p) => [p.key, m?.[p.key] === null || m?.[p.key] === undefined ? "" : String(m[p.key])]))];
        }),
      ) as Draft,
    );
  }

  const invalid = (value: string, max: number) => value !== "" && (!/^\d+(\.\d)?$/.test(value) || Number(value) > max);
  const errors = students.flatMap((s) => MARK_PARTS.filter((p) => invalid(draft[s.id]?.[p.key] ?? "", p.max)).map((p) => `${s.name}: ${p.label} must be 0–${p.max}`));

  function save() {
    if (errors.length) return toast(`Fix ${errors.length} invalid mark${errors.length === 1 ? "" : "s"} first`, "error");
    update((d) => {
      for (const s of students) {
        const values = Object.fromEntries(MARK_PARTS.map((p) => [p.key, draft[s.id]?.[p.key] === "" ? null : Number(draft[s.id]?.[p.key])])) as Pick<Mark, "attendance" | "classTest" | "midterm" | "final">;
        const existing = d.marks.find((x) => x.sectionId === sectionId && x.courseId === courseId && x.studentId === s.id);
        if (existing) Object.assign(existing, values);
        else d.marks.push({ id: newId(), sectionId, courseId, studentId: s.id, ...values });
      }
    });
    toast(`Marks saved for ${lookup(db.courses, courseId)?.code} · ${section?.name}`);
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
        <span className="text-xs text-muted">Teacher: {lookup(db.teachers, section?.courses.find((c) => c.courseId === courseId)?.teacherId)?.name ?? "—"}</span>
      </Toolbar>
      {published && <p className="border-b border-border bg-warning/8 px-5 py-2 text-xs text-warning">This section&apos;s result is published, so marks are locked. Unpublish it under Results to make corrections.</p>}
      <Table head={["Student", ...MARK_PARTS.map((p) => `${p.label} /${p.max}`), "Total", "Grade"]} empty={!students.length && <EmptyState icon="users" title="No students in this section" />}>
        {students.map((s) => {
          const row = draft[s.id];
          const parts = MARK_PARTS.map((p) => (row?.[p.key] === "" || row?.[p.key] === undefined ? null : Number(row[p.key])));
          const complete = parts.every((v) => v !== null);
          const total = parts.reduce<number>((a, v) => a + (v ?? 0), 0);
          const g = grade(total);
          return (
            <Tr key={s.id}>
              <Td>
                <p className="font-medium">{s.name}</p>
                <p className="font-mono text-xs text-muted">{s.studentId}</p>
              </Td>
              {MARK_PARTS.map((p) => (
                <Td key={p.key}>
                  <input
                    value={row?.[p.key] ?? ""}
                    disabled={published}
                    inputMode="decimal"
                    aria-label={`${p.label} for ${s.name}`}
                    onChange={(e) => setDraft({ ...draft, [s.id]: { ...row!, [p.key]: e.target.value.trim() } })}
                    className={cx(
                      "h-9 w-16 rounded-lg border bg-surface-2/60 px-2 text-center text-sm tabular-nums focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none disabled:opacity-60",
                      invalid(row?.[p.key] ?? "", p.max) ? "border-danger text-danger" : "border-border-strong",
                    )}
                  />
                </Td>
              ))}
              <Td className="font-semibold tabular-nums">{total}</Td>
              <Td>{complete ? <Badge tone={g.letter === "F" ? "danger" : "accent"}>{g.letter}</Badge> : <span className="text-xs text-subtle">pending</span>}</Td>
            </Tr>
          );
        })}
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <p className="text-xs text-danger">{errors[0] ?? ""}</p>
        <Button onClick={save} disabled={published || !students.length} icon="check">
          Save marks
        </Button>
      </div>
    </Card>
  );
}

// ── Eligibility & admit cards ───────────────────────────────────────────

/**
 * Exam office checks with the other offices' data: attendance from the
 * department, dues from Accounts. Only eligible students get an admit card.
 */
function Admit({ db }: { db: DemoDb }) {
  const { tenant } = useAuth();
  const today = todayDhaka();
  const sections = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING");
  const upcoming = db.exams.filter((e) => e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [examId, setExamId] = useState(upcoming[0]?.id ?? db.exams[0]?.id ?? "");
  const [printing, setPrinting] = useState(false);
  const exam = lookup(db.exams, examId);
  const rows = db.students
    .filter((s) => s.sectionId === sectionId && s.status !== "DROPPED")
    .sort((a, b) => a.studentId.localeCompare(b.studentId))
    .map((s) => ({ s, ...examEligibility(db, s, today) }));
  const eligible = rows.filter((r) => r.eligible);

  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Exam" value={examId} onChange={setExamId}>
          {db.exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <span className="text-xs text-muted">
          {eligible.length} of {rows.length} eligible · needs 75% attendance and no overdue fees
        </span>
        <Button size="sm" icon="printer" className="ml-auto" disabled={!eligible.length || !exam} onClick={() => setPrinting(true)}>
          Admit cards ({eligible.length})
        </Button>
      </Toolbar>
      <Table head={["Student", "Attendance", "Eligibility"]} empty={!rows.length && <EmptyState icon="users" title="No students in this section" />}>
        {rows.map(({ s, eligible: ok, reasons, attendance }) => (
          <Tr key={s.id}>
            <Td>
              <p className="font-medium">{s.name}</p>
              <p className="font-mono text-xs text-muted">{s.studentId}</p>
            </Td>
            <Td className={cx("tabular-nums", attendance !== null && attendance < 75 && "text-danger")}>{attendance === null ? "—" : `${attendance}%`}</Td>
            <Td>{ok ? <Badge tone="success" dot>Eligible</Badge> : <span className="text-xs text-danger">{reasons.join(" · ")}</span>}</Td>
          </Tr>
        ))}
      </Table>
      <Modal open={printing} onClose={() => setPrinting(false)} title={`Admit cards · ${exam?.name ?? ""}`} size="xl">
        {printing && exam && (
          <>
            <div className="print-area grid gap-4 sm:grid-cols-2">
              {eligible.map(({ s }) => (
                <AdmitCard key={s.id} db={db} institution={tenant?.name ?? ""} exam={exam} student={s} />
              ))}
            </div>
            <FormActions>
              <Button variant="secondary" onClick={() => setPrinting(false)}>
                Close
              </Button>
              <PrintButton label="Print all" />
            </FormActions>
          </>
        )}
      </Modal>
    </Card>
  );
}

function Scale() {
  return (
    <Card title="UGC uniform grading system" description="Used by public and private universities in Bangladesh">
      <Table head={["Marks", "Letter grade", "Grade point"]}>
        {GRADE_SCALE.map(([min, letter, point], i) => (
          <Tr key={letter}>
            <Td className="tabular-nums">{i === 0 ? "80 and above" : `${min} – ${GRADE_SCALE[i - 1]![0] - 1}`}</Td>
            <Td>
              <Badge tone={letter === "F" ? "danger" : "accent"}>{letter}</Badge>
            </Td>
            <Td className="tabular-nums">{point.toFixed(2)}</Td>
          </Tr>
        ))}
      </Table>
    </Card>
  );
}
