"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { officialEmailFor } from "@/lib/demo/workflows";
import {
  attendanceStats,
  BD_PHONE,
  BLOOD_GROUPS,
  DIVISIONS,
  formatGpa,
  generateStudentId,
  invoiceStatus,
  invoiceTotals,
  lookup,
  methodLabel,
  MIN_ATTENDANCE,
  newId,
  normalizePhone,
  nowIso,
  semesterResult,
  taka,
  todayDhaka,
} from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Guardian, Student, StudentStatus } from "@/lib/demo/types";
import { InfoGrid, Progress, Tabs, useCampusOptions, useStudentIdFormat } from "./demo";
import { Icon } from "./icons";
import { Avatar, Badge, Button, ErrorNote, Field, FormActions, formatDate, Input, Modal, Select, Table, Td, Tr, useToast } from "./ui";

export const STATUS_TONE: Record<StudentStatus, "success" | "warning" | "accent" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  GRADUATED: "accent",
  DROPPED: "neutral",
};
export const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

export const INVOICE_TONE = { PAID: "success", PARTIAL: "accent", UNPAID: "neutral", OVERDUE: "danger" } as const;

/** Program code and section for a student, e.g. "CSE · CSE-61A". */
export function programLine(db: DemoDb, student: Student) {
  const program = lookup(db.programs, student.programId);
  const dept = program && lookup(db.departments, program.departmentId);
  const section = lookup(db.sections, student.sectionId);
  return [dept?.code, section?.name].filter(Boolean).join(" · ");
}

// ── Profile ──────────────────────────────────────────────────────────────

type ProfileTab = "overview" | "attendance" | "results" | "fees";

export function StudentProfile({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  const { db } = useDemo();
  const student = db && studentId ? lookup(db.students, studentId) : undefined;
  return (
    <Modal open={!!student} onClose={onClose} title={student?.name ?? "Student"} size="xl" description={student && db ? <ProfileSubtitle db={db} student={student} /> : undefined}>
      {student && db && <ProfileBody db={db} student={student} onClose={onClose} />}
    </Modal>
  );
}

function ProfileSubtitle({ db, student }: { db: DemoDb; student: Student }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-text">{student.studentId}</code>
      <span>{lookup(db.programs, student.programId)?.name}</span>
      <Badge tone={STATUS_TONE[student.status]} dot>
        {statusLabel(student.status)}
      </Badge>
    </span>
  );
}

function ProfileBody({ db, student, onClose }: { db: DemoDb; student: Student; onClose: () => void }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [editing, setEditing] = useState(false);
  const [guardian, setGuardian] = useState<Guardian | "new" | null>(null);
  const today = todayDhaka();
  const section = lookup(db.sections, student.sectionId);
  const guardians = student.guardianIds.map((id) => lookup(db.guardians, id)).filter((g): g is Guardian => !!g);
  const manage = can("students.manage");

  if (editing) {
    return <StudentForm student={student} onDone={() => setEditing(false)} />;
  }
  if (guardian) {
    return <GuardianForm studentId={student.id} guardian={guardian === "new" ? null : guardian} onDone={() => setGuardian(null)} />;
  }

  const setStatus = (status: StudentStatus) => {
    update((d) => {
      d.students.find((s) => s.id === student.id)!.status = status;
    });
    toast(`${student.name} is now ${statusLabel(status).toLowerCase()}`);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "attendance", label: "Attendance" },
            { key: "results", label: "Results" },
            { key: "fees", label: "Fees" },
          ]}
        />
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold">Personal</h3>
              <InfoGrid
                items={[
                  ["Gender", statusLabel(student.gender)],
                  ["Date of birth", formatDate(student.dateOfBirth)],
                  ["Blood group", student.bloodGroup],
                  ["Mobile", student.phone],
                  ["Email", student.email],
                  ["Address", [student.address, student.district, student.division].filter(Boolean).join(", ")],
                ]}
              />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold">Academic</h3>
              <InfoGrid
                items={[
                  ["Program", lookup(db.programs, student.programId)?.name],
                  ["Section", section ? `${section.name} (${lookup(db.semesters, section.semesterId)?.name})` : null],
                  ["Batch", student.batch],
                  ["Campus", student.campus],
                  ["Admitted", formatDate(student.admissionDate)],
                  ["Scholarship", db.scholarships.filter((s) => s.studentIds.includes(student.id)).map((s) => `${s.name} (${s.percent}%)`).join(", ")],
                ]}
              />
            </section>
            {manage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>
                  Edit details
                </Button>
                {student.status !== "ACTIVE" && (
                  <Button variant="secondary" onClick={() => setStatus("ACTIVE")}>
                    Reactivate
                  </Button>
                )}
                {student.status === "ACTIVE" && (
                  <>
                    <Button variant="ghost" onClick={() => setStatus("SUSPENDED")}>
                      Suspend
                    </Button>
                    <Button variant="ghost" onClick={() => setStatus("GRADUATED")}>
                      Mark graduated
                    </Button>
                    <Button variant="ghost" onClick={() => setStatus("DROPPED")}>
                      Mark dropped out
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
          <section className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Guardians</h3>
              {can("guardians.manage") && (
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setGuardian("new")}>
                  Add
                </Button>
              )}
            </div>
            {guardians.length === 0 && <p className="text-sm text-muted">No guardian on record.</p>}
            <ul className="space-y-3">
              {guardians.map((g) => (
                <li key={g.id} className="flex items-start gap-3">
                  <Avatar name={g.name} size="sm" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted">
                      {g.relation}
                      {g.occupation ? ` · ${g.occupation}` : ""}
                    </p>
                    <a href={`tel:${g.phone}`} className="text-xs text-accent">
                      {g.phone}
                    </a>
                  </div>
                  {can("guardians.manage") && (
                    <button onClick={() => setGuardian(g)} className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-text" aria-label={`Edit ${g.name}`}>
                      <Icon name="pencil" className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <PortalLogin student={student} />
          </div>
        </div>
      )}

      {tab === "attendance" && <ProfileAttendance db={db} student={student} />}
      {tab === "results" && <ProfileResults db={db} student={student} />}
      {tab === "fees" && (
        <div className="space-y-4">
          {db.invoices.filter((i) => i.studentId === student.id).length === 0 && <p className="text-sm text-muted">No invoices yet.</p>}
          {db.invoices
            .filter((i) => i.studentId === student.id)
            .map((inv) => {
              const totals = invoiceTotals(inv, db.payments);
              const status = invoiceStatus(inv, db.payments, today);
              return (
                <div key={inv.id} className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {inv.invoiceNo} · {lookup(db.semesters, inv.semesterId)?.name}
                      </p>
                      <p className="text-xs text-muted">Due {formatDate(inv.dueDate)}</p>
                    </div>
                    <Badge tone={INVOICE_TONE[status]} dot>
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="text-xs text-subtle">Payable</p>
                      <p className="font-medium tabular-nums">{taka(totals.net)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">Paid</p>
                      <p className="font-medium text-success tabular-nums">{taka(totals.paid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">Due</p>
                      <p className={totals.due ? "font-medium text-danger tabular-nums" : "font-medium tabular-nums"}>{taka(totals.due)}</p>
                    </div>
                  </div>
                  {db.payments.some((p) => p.invoiceId === inv.id) && (
                    <ul className="divide-y divide-border border-t border-border text-sm">
                      {db.payments
                        .filter((p) => p.invoiceId === inv.id)
                        .map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                            <span className="text-muted">
                              {formatDate(p.paidAt)} · {methodLabel(p.method)}
                              {p.transactionId ? ` · ${p.transactionId}` : ""}
                            </span>
                            <span className="font-medium tabular-nums">{taka(p.amount)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </FormActions>
    </div>
  );
}

export function ProfileAttendance({ db, student }: { db: DemoDb; student: Student }) {
  const section = lookup(db.sections, student.sectionId);
  if (!section) return <p className="text-sm text-muted">Not assigned to a section.</p>;
  const sheets = db.attendance.filter((a) => a.sectionId === section.id);
  const overall = attendanceStats(sheets, student.id);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Overall this semester</p>
          <p className="text-2xl font-semibold tabular-nums">{overall.percent ?? "—"}%</p>
        </div>
        <div className="mt-2">
          <Progress value={overall.percent ?? 0} tone={(overall.percent ?? 100) < MIN_ATTENDANCE ? "danger" : "success"} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {overall.present} present · {overall.late} late · {overall.absent} absent of {overall.total} classes
          {(overall.percent ?? 100) < MIN_ATTENDANCE && <span className="text-danger"> · below the {MIN_ATTENDANCE}% needed to sit the final exam</span>}
        </p>
      </div>
      <Table head={["Course", "Classes", "Present", "Late", "Absent", "Attendance"]}>
        {section.courses.map(({ courseId }) => {
          const course = lookup(db.courses, courseId)!;
          const s = attendanceStats(
            sheets.filter((x) => x.courseId === courseId),
            student.id,
          );
          return (
            <Tr key={courseId}>
              <Td>
                <span className="font-mono text-xs text-muted">{course.code}</span> {course.title}
              </Td>
              <Td className="tabular-nums">{s.total}</Td>
              <Td className="tabular-nums">{s.present}</Td>
              <Td className="tabular-nums">{s.late}</Td>
              <Td className="tabular-nums">{s.absent}</Td>
              <Td>
                <span className={(s.percent ?? 100) < MIN_ATTENDANCE ? "font-medium text-danger" : "font-medium"}>{s.percent ?? "—"}%</span>
              </Td>
            </Tr>
          );
        })}
      </Table>
    </div>
  );
}

export function ProfileResults({ db, student }: { db: DemoDb; student: Student }) {
  const section = lookup(db.sections, student.sectionId);
  if (!section) return <p className="text-sm text-muted">Not assigned to a section.</p>;
  const result = semesterResult(db, section.id, student.id)!;
  const published = db.publications.some((p) => p.sectionId === section.id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{lookup(db.semesters, section.semesterId)?.name} · {section.name}</p>
          <p className="text-xs text-muted">{published ? "Result published" : result.complete ? "All marks in, not yet published" : "Marks still being entered"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-subtle">Semester GPA</p>
          <p className="text-2xl font-semibold tabular-nums">{result.complete ? formatGpa(result.gpa) : "—"}</p>
        </div>
      </div>
      <Table head={["Course", "Credits", "Att. /10", "CT /20", "Mid /30", "Final /40", "Total", "Grade"]}>
        {result.rows.map((r) => (
          <Tr key={r.course.id}>
            <Td>
              <span className="font-mono text-xs text-muted">{r.course.code}</span> {r.course.title}
            </Td>
            <Td className="tabular-nums">{r.course.credits}</Td>
            <Td className="tabular-nums">{r.mark?.attendance ?? "—"}</Td>
            <Td className="tabular-nums">{r.mark?.classTest ?? "—"}</Td>
            <Td className="tabular-nums">{r.mark?.midterm ?? "—"}</Td>
            <Td className="tabular-nums">{r.mark?.final ?? "—"}</Td>
            <Td className="font-medium tabular-nums">{r.mark ? r.total : "—"}</Td>
            <Td>{r.complete ? <Badge tone={r.letter === "F" ? "danger" : "accent"}>{r.letter}</Badge> : <span className="text-subtle">—</span>}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}

// ── Portal login ─────────────────────────────────────────────────────────

/** Readable one-time password: no 0/O or 1/l confusion. */
function initialPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `${[...bytes].map((b) => chars[b % chars.length]).join("")}!`;
}

/**
 * Creates the student's real sign-in account (API + Postgres) with the
 * Student role, so they can open their own portal with their official email.
 */
function PortalLogin({ student }: { student: Student }) {
  const { can, tenant } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!can("users.manage") && !student.officialEmail) return null;

  async function create() {
    if (!tenant) return;
    setBusy(true);
    setError(null);
    const email = officialEmailFor(student, tenant.slug);
    const password = initialPassword();
    try {
      const roles = await api<{ id: string; key: string | null }[]>("/roles");
      const role = roles.find((r) => r.key === "student");
      if (!role) throw new Error("This institution has no Student role.");
      const existing = await api<{ items: { email: string }[] }>(`/users?search=${encodeURIComponent(email)}`);
      if (existing.items.some((u) => u.email === email)) {
        update((d) => {
          d.students.find((x) => x.id === student.id)!.officialEmail = email;
        });
        toast("A login already exists for this email; linked it to the student");
        return;
      }
      await api("/users", { method: "POST", json: { fullName: student.name, email, password, roles: [{ roleId: role.id }] } });
      update((d) => {
        d.students.find((x) => x.id === student.id)!.officialEmail = email;
      });
      setIssued({ email, password });
      toast("Portal login created");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-2 text-sm font-semibold">Student portal login</h3>
      {issued ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted">Give these to the student once. The password isn&apos;t shown again.</p>
          <p>
            Institution code: <code className="font-mono">{tenant?.slug}</code>
          </p>
          <p className="break-all">
            Email: <code className="font-mono">{issued.email}</code>
          </p>
          <p>
            Password: <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono">{issued.password}</code>
          </p>
        </div>
      ) : student.officialEmail ? (
        <p className="text-sm text-muted">
          Signs in as <code className="font-mono break-all text-text">{student.officialEmail}</code>
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">Creates an official email login with the Student role. They&apos;ll see only their own records.</p>
          <ErrorNote message={error} />
          <Button size="sm" icon="key" disabled={busy} onClick={() => void create()} className="mt-2">
            {busy ? "Creating…" : "Create portal login"}
          </Button>
        </>
      )}
    </section>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string) => text(form, key) || null;

/** Add or edit a student. New students also get their first guardian and an ID. */
export function StudentForm({ student, onDone, onCreated }: { student: Student | null; onDone: () => void; onCreated?: (id: string) => void }) {
  const { db, update } = useDemo();
  const toast = useToast();
  const idFormat = useStudentIdFormat();
  const campuses = useCampusOptions();
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState(student?.programId ?? db?.programs[0]?.id ?? "");
  if (!db) return null;
  const sections = db.sections.filter((s) => s.programId === programId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const phone = normalizePhone(text(f, "phone"));
    const problems: string[] = [];
    if (text(f, "name").length < 3) problems.push("Enter the student's full name.");
    if (!BD_PHONE.test(phone)) problems.push("Mobile must be a Bangladeshi number like 01712345678.");
    if (!text(f, "dateOfBirth")) problems.push("Enter the date of birth.");
    const guardianPhone = normalizePhone(text(f, "guardianPhone"));
    if (!student) {
      if (text(f, "guardianName").length < 3) problems.push("Enter the guardian's name.");
      if (!BD_PHONE.test(guardianPhone)) problems.push("Guardian mobile must be a Bangladeshi number.");
    }
    const email = optional(f, "email");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) problems.push("Email address isn't valid.");
    if (problems.length) return setError(problems.join("\n"));

    const fields = {
      name: text(f, "name"),
      gender: text(f, "gender") as Student["gender"],
      dateOfBirth: text(f, "dateOfBirth"),
      bloodGroup: optional(f, "bloodGroup"),
      phone,
      email,
      programId,
      sectionId: optional(f, "sectionId"),
      batch: text(f, "batch") || "—",
      campus: optional(f, "campus"),
      admissionDate: text(f, "admissionDate") || todayDhaka(),
      division: optional(f, "division"),
      district: optional(f, "district"),
      address: optional(f, "address"),
    };
    let createdId = "";
    let createdStudentId = "";
    update((d) => {
      if (student) {
        Object.assign(d.students.find((s) => s.id === student.id)!, fields);
        return;
      }
      const program = lookup(d.programs, programId)!;
      const dept = lookup(d.departments, program.departmentId)!;
      const campusCode = campuses.find((c) => c.name === fields.campus)?.code ?? null;
      const guardian: Guardian = {
        id: newId(),
        name: text(f, "guardianName"),
        relation: text(f, "guardianRelation") as Guardian["relation"],
        phone: guardianPhone,
        email: null,
        occupation: optional(f, "guardianOccupation"),
      };
      d.guardians.push(guardian);
      createdId = newId();
      createdStudentId = generateStudentId(d, idFormat, { year: Number(fields.admissionDate.slice(0, 4)), dept: dept.code, campus: campusCode });
      d.students.push({ id: createdId, studentId: createdStudentId, ...fields, status: "ACTIVE", guardianIds: [guardian.id], createdAt: nowIso() });
    });
    toast(student ? "Student updated" : `${fields.name} added with ID ${createdStudentId}`);
    if (createdId) onCreated?.(createdId);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" className="sm:col-span-2">
        <Input name="name" defaultValue={student?.name} required autoFocus placeholder="As on the SSC certificate" />
      </Field>
      <Field label="Gender">
        <Select name="gender" defaultValue={student?.gender ?? "MALE"}>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Date of birth">
        <Input name="dateOfBirth" type="date" defaultValue={student?.dateOfBirth} required />
      </Field>
      <Field label="Mobile" hint="01XXXXXXXXX">
        <Input name="phone" defaultValue={student?.phone} inputMode="tel" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={student?.email ?? ""} />
      </Field>
      <Field label="Blood group">
        <Select name="bloodGroup" defaultValue={student?.bloodGroup ?? ""}>
          <option value="">Unknown</option>
          {BLOOD_GROUPS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </Field>
      <Field label="Campus">
        <Select name="campus" defaultValue={student?.campus ?? campuses.find(() => true)?.name ?? ""}>
          <option value="">—</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <p className="col-span-full -mb-1 pt-2 text-xs font-semibold tracking-wider text-subtle uppercase">Academic</p>
      <Field label="Program" className="sm:col-span-2">
        <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {db.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Section">
        <Select key={programId} name="sectionId" defaultValue={student?.programId === programId ? (student?.sectionId ?? "") : (sections[0]?.id ?? "")}>
          <option value="">Not assigned</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {lookup(db.semesters, s.semesterId)?.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Batch">
        <Input name="batch" defaultValue={student?.batch ?? sections[0]?.batch ?? ""} placeholder="e.g. 61" />
      </Field>
      <Field label="Admission date" hint={student ? undefined : "The year sets the student ID"}>
        <Input name="admissionDate" type="date" defaultValue={student?.admissionDate} />
      </Field>
      {student && (
        <Field label="Student ID" hint="IDs don't change once issued">
          <Input value={student.studentId} disabled className="font-mono" />
        </Field>
      )}

      <p className="col-span-full -mb-1 pt-2 text-xs font-semibold tracking-wider text-subtle uppercase">Address</p>
      <Field label="Division">
        <Select name="division" defaultValue={student?.division ?? ""}>
          <option value="">—</option>
          {DIVISIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </Field>
      <Field label="District">
        <Input name="district" defaultValue={student?.district ?? ""} />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Input name="address" defaultValue={student?.address ?? ""} placeholder="House, road, area" />
      </Field>

      {!student && (
        <>
          <p className="col-span-full -mb-1 pt-2 text-xs font-semibold tracking-wider text-subtle uppercase">Guardian</p>
          <Field label="Guardian name">
            <Input name="guardianName" required />
          </Field>
          <Field label="Relation">
            <Select name="guardianRelation" defaultValue="Father">
              {["Father", "Mother", "Brother", "Sister", "Uncle", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Guardian mobile">
            <Input name="guardianPhone" inputMode="tel" required />
          </Field>
          <Field label="Occupation">
            <Input name="guardianOccupation" />
          </Field>
        </>
      )}
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{student ? "Save changes" : "Add student"}</Button>
      </FormActions>
    </form>
  );
}

export function GuardianForm({ guardian, studentId, onDone }: { guardian: Guardian | null; studentId?: string; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const phone = normalizePhone(text(f, "phone"));
    if (text(f, "name").length < 3) return setError("Enter the guardian's name.");
    if (!BD_PHONE.test(phone)) return setError("Mobile must be a Bangladeshi number like 01712345678.");
    const fields = {
      name: text(f, "name"),
      relation: text(f, "relation") as Guardian["relation"],
      phone,
      email: optional(f, "email"),
      occupation: optional(f, "occupation"),
    };
    update((d) => {
      if (guardian) {
        Object.assign(d.guardians.find((g) => g.id === guardian.id)!, fields);
      } else {
        const id = newId();
        d.guardians.push({ id, ...fields });
        if (studentId) d.students.find((s) => s.id === studentId)!.guardianIds.push(id);
      }
    });
    toast(guardian ? "Guardian updated" : "Guardian added");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={guardian?.name} required autoFocus />
      </Field>
      <Field label="Relation">
        <Select name="relation" defaultValue={guardian?.relation ?? "Father"}>
          {["Father", "Mother", "Brother", "Sister", "Uncle", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <Field label="Mobile">
        <Input name="phone" defaultValue={guardian?.phone} inputMode="tel" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={guardian?.email ?? ""} />
      </Field>
      <Field label="Occupation">
        <Input name="occupation" defaultValue={guardian?.occupation ?? ""} />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{guardian ? "Save changes" : "Add guardian"}</Button>
      </FormActions>
    </form>
  );
}
