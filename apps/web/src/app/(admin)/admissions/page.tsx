"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { BD_PHONE, BOARDS, DIVISIONS, downloadCsv, generateStudentId, lookup, newId, nextCounter, normalizePhone, nowIso, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { Application, ApplicationStatus, DemoDb, Guardian } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, InfoGrid, Tabs, Textarea, Toolbar, useCampusOptions, useStudentIdFormat } from "@/components/demo";
import { StudentProfile } from "@/components/students";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatCard, Table, Td, timeAgo, Tr, useToast } from "@/components/ui";

const STATUS: Record<ApplicationStatus, { label: string; tone: "neutral" | "accent" | "success" | "danger" | "warning" }> = {
  SUBMITTED: { label: "Submitted", tone: "neutral" },
  UNDER_REVIEW: { label: "Under review", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "accent" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ENROLLED: { label: "Enrolled", tone: "success" },
};

/** UGC minimum for private universities: GPA 2.5 in each of SSC and HSC, 6.0 combined. */
const eligible = (a: Pick<Application, "sscGpa" | "hscGpa">) => a.sscGpa >= 2.5 && a.hscGpa >= 2.5 && a.sscGpa + a.hscGpa >= 6;
const PASS_MARK = 40;
const merit = (a: Application) => (a.testScore ?? 0) * 0.6 + (a.sscGpa + a.hscGpa) * 4;
const PAGE_SIZE = 15;

export default function AdmissionsPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [tab, setTab] = useState<ApplicationStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("");
  const [sort, setSort] = useState<"recent" | "merit">("recent");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!db) return [];
    const q = query.trim().toLowerCase();
    return db.applications
      .filter((a) => (tab === "ALL" || a.status === tab) && (!program || a.programId === program) && (!q || a.name.toLowerCase().includes(q) || a.applicationNo.toLowerCase().includes(q) || a.phone.includes(q)))
      .sort((a, b) => (sort === "merit" ? merit(b) - merit(a) : b.appliedAt.localeCompare(a.appliedAt)));
  }, [db, tab, query, program, sort]);

  const count = (s: ApplicationStatus) => db?.applications.filter((a) => a.status === s).length ?? 0;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);

  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Admissions"
        description="Applications for the coming intake: review, record the admission test, accept, and enroll as students."
        actions={
          <>
            <DemoNotice />
            {can("admissions.manage") && (
              <Button icon="plus" onClick={() => setCreating(true)}>
                New application
              </Button>
            )}
          </>
        }
      />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Applications" value={db.applications.length} icon="clipboard" />
            <StatCard label="To review" value={count("SUBMITTED") + count("UNDER_REVIEW")} icon="clock" />
            <StatCard label="Accepted" value={count("ACCEPTED")} sub="awaiting enrollment" icon="check" />
            <StatCard label="Enrolled" value={count("ENROLLED")} icon="graduation" />
          </div>
          <Tabs
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
            tabs={[{ key: "ALL" as const, label: "All", count: db.applications.length }, ...(Object.keys(STATUS) as ApplicationStatus[]).map((s) => ({ key: s, label: STATUS[s].label, count: count(s) }))]}
          />
          <Card>
            <Toolbar>
              <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search name, application no. or mobile" />
              <FilterSelect label="Program" value={program} onChange={(v) => { setProgram(v); setPage(1); }}>
                <option value="">All programs</option>
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Sort" value={sort} onChange={(v) => setSort(v as "recent" | "merit")}>
                <option value="recent">Newest first</option>
                <option value="merit">Merit (test + GPA)</option>
              </FilterSelect>
              <span className="ml-auto text-xs text-muted">{rows.length} applications</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={!rows.length}
                onClick={() =>
                  downloadCsv(`applications-${todayDhaka()}.csv`, [
                    ["Application no.", "Name", "Mobile", "Program", "SSC GPA", "HSC GPA", "Board", "Test score", "Status", "Applied"],
                    ...rows.map((a) => [a.applicationNo, a.name, a.phone, lookup(db.programs, a.programId)?.code, a.sscGpa, a.hscGpa, a.board, a.testScore, STATUS[a.status].label, a.appliedAt.slice(0, 10)]),
                  ])
                }
              >
                Export CSV
              </Button>
            </Toolbar>
            <Table
              head={["Applicant", "Program", "SSC / HSC", "Test", "Applied", "Status", ""]}
              empty={!rows.length && <EmptyState icon="clipboard" title="No applications here" description={tab === "ALL" ? "New applications appear here." : "Nothing with this status right now."} />}
            >
              {rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <button onClick={() => setOpen(a.id)} className="flex items-center gap-3 text-left">
                      <Avatar name={a.name} />
                      <span>
                        <span className="block font-medium hover:text-accent">{a.name}</span>
                        <span className="block font-mono text-xs text-muted">{a.applicationNo}</span>
                      </span>
                    </button>
                  </Td>
                  <Td className="text-muted">{lookup(db.programs, a.programId)?.code}</Td>
                  <Td>
                    <span className="tabular-nums">
                      {a.sscGpa.toFixed(2)} / {a.hscGpa.toFixed(2)}
                    </span>
                    {!eligible(a) && <span className="ml-2 text-xs text-danger">not eligible</span>}
                  </Td>
                  <Td className="tabular-nums">{a.testScore === null ? <span className="text-subtle">—</span> : <span className={a.testScore < PASS_MARK ? "text-danger" : ""}>{a.testScore}</span>}</Td>
                  <Td className="text-muted">{timeAgo(a.appliedAt)}</Td>
                  <Td>
                    <Badge tone={STATUS[a.status].tone} dot>
                      {STATUS[a.status].label}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(a.id)}>
                      Review
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Table>
            <Pagination page={current} pages={pages} onPage={setPage} />
          </Card>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New application" description="For walk-in or phone applicants. Online applications land here too once the portal is live." size="lg">
        <ApplicationForm onDone={() => setCreating(false)} />
      </Modal>
      {db && (
        <ApplicationDetail
          db={db}
          applicationId={open}
          onClose={() => setOpen(null)}
          onOpenStudent={(id) => {
            setOpen(null);
            setProfile(id);
          }}
        />
      )}
      <StudentProfile studentId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

function ApplicationDetail({ db, applicationId, onClose, onOpenStudent }: { db: DemoDb; applicationId: string | null; onClose: () => void; onOpenStudent: (id: string) => void }) {
  const a = lookup(db.applications, applicationId);
  return (
    <Modal open={!!a} onClose={onClose} title={a?.name ?? ""} size="lg" description={a && <span className="font-mono text-xs">{a.applicationNo} · applied {formatDate(a.appliedAt, true)}</span>}>
      {a && <DetailBody key={a.id + a.status} db={db} a={a} onClose={onClose} onOpenStudent={onOpenStudent} />}
    </Modal>
  );
}

function DetailBody({ db, a, onClose, onOpenStudent }: { db: DemoDb; a: Application; onClose: () => void; onOpenStudent: (id: string) => void }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const idFormat = useStudentIdFormat();
  const campuses = useCampusOptions();
  const [score, setScore] = useState(a.testScore === null ? "" : String(a.testScore));
  const [notes, setNotes] = useState(a.notes ?? "");
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const review = can("admissions.review");
  const program = lookup(db.programs, a.programId);
  const sections = db.sections.filter((s) => s.programId === a.programId && lookup(db.semesters, s.semesterId)?.status !== "COMPLETED");

  const parsedScore = score.trim() === "" ? null : Number(score);
  const save = (status: ApplicationStatus, message: string) => {
    if (parsedScore !== null && (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100)) return setError("Test score must be between 0 and 100.");
    update((d) => {
      const x = d.applications.find((y) => y.id === a.id)!;
      x.status = status;
      x.testScore = parsedScore;
      x.notes = notes.trim() || null;
      if (status === "ACCEPTED" || status === "REJECTED") x.decidedAt = nowIso();
    });
    toast(message);
  };

  function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const sectionId = String(f.get("sectionId") ?? "") || null;
    const campus = String(f.get("campus") ?? "") || null;
    const withInvoice = f.get("invoice") === "on";
    let studentRowId = "";
    let issued = "";
    update((d) => {
      const app = d.applications.find((y) => y.id === a.id)!;
      const prog = lookup(d.programs, app.programId)!;
      const dept = lookup(d.departments, prog.departmentId)!;
      const section = lookup(d.sections, sectionId);
      const today = todayDhaka();
      const guardian: Guardian = { id: newId(), name: app.guardianName, relation: app.guardianRelation, phone: app.guardianPhone, email: null, occupation: null };
      d.guardians.push(guardian);
      studentRowId = newId();
      issued = generateStudentId(d, idFormat, { year: Number(today.slice(0, 4)), dept: dept.code, campus: campuses.find((c) => c.name === campus)?.code ?? null });
      d.students.push({
        id: studentRowId,
        studentId: issued,
        name: app.name,
        gender: app.gender,
        dateOfBirth: app.dateOfBirth,
        bloodGroup: null,
        phone: app.phone,
        email: app.email,
        programId: app.programId,
        sectionId,
        batch: section?.batch ?? "—",
        campus,
        admissionDate: today,
        status: "ACTIVE",
        division: app.division,
        district: app.district,
        address: null,
        guardianIds: [guardian.id],
        createdAt: nowIso(),
      });
      if (withInvoice) {
        const structure = d.feeStructures.find((s) => s.programId === app.programId);
        const semesterId = section?.semesterId ?? d.semesters.find((s) => s.status === "ONGOING")?.id;
        if (structure && semesterId) {
          d.invoices.push({
            id: newId(),
            invoiceNo: `INV-${today.slice(0, 4)}-${String(nextCounter(d, "invoice")).padStart(5, "0")}`,
            studentId: studentRowId,
            semesterId,
            items: structure.items.map((i) => ({ ...i })),
            discount: 0,
            discountLabel: null,
            dueDate: new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10),
            issuedAt: nowIso(),
          });
        }
      }
      app.status = "ENROLLED";
      app.studentId = studentRowId;
    });
    toast(`${a.name} enrolled with student ID ${issued}`);
    onOpenStudent(studentRowId);
  }

  if (enrolling) {
    return (
      <form onSubmit={enroll} className="grid gap-4 sm:grid-cols-2">
        <p className="col-span-full text-sm text-muted">
          Creates the student record and guardian, and issues a student ID for <span className="font-medium text-text">{program?.name}</span>.
        </p>
        <Field label="Section">
          <Select name="sectionId" defaultValue={sections[0]?.id ?? ""}>
            <option value="">Assign later</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {lookup(db.semesters, s.semesterId)?.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Campus">
          <Select name="campus" defaultValue={campuses[0]?.name ?? ""}>
            <option value="">—</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="col-span-full flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="invoice" defaultChecked className="size-4 accent-[var(--accent)]" />
          Issue the semester fee invoice now (due in 30 days)
        </label>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => setEnrolling(false)}>
            Back
          </Button>
          <Button type="submit" icon="graduation">
            Enroll student
          </Button>
        </FormActions>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS[a.status].tone} dot>
          {STATUS[a.status].label}
        </Badge>
        {eligible(a) ? <Badge tone="success">Meets GPA requirement</Badge> : <Badge tone="danger">Below the UGC GPA minimum</Badge>}
        {a.decidedAt && <span className="text-xs text-muted">Decided {formatDate(a.decidedAt)}</span>}
      </div>
      <InfoGrid
        items={[
          ["Program", program?.name],
          ["Mobile", a.phone],
          ["Email", a.email],
          ["Gender · Date of birth", `${a.gender.charAt(0) + a.gender.slice(1).toLowerCase()} · ${formatDate(a.dateOfBirth)}`],
          ["SSC GPA", a.sscGpa.toFixed(2)],
          ["HSC GPA", `${a.hscGpa.toFixed(2)} (${a.board} board, ${a.hscYear})`],
          ["Guardian", `${a.guardianName} (${a.guardianRelation}) · ${a.guardianPhone}`],
          ["Home district", [a.district, a.division].filter(Boolean).join(", ")],
        ]}
      />
      {a.status !== "ENROLLED" && review ? (
        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[160px_1fr]">
          <Field label="Admission test" hint={`Out of 100 · pass mark ${PASS_MARK}`}>
            <Input value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" placeholder="—" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interview remarks, missing documents…" className="min-h-10" />
          </Field>
        </div>
      ) : (
        a.notes && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{a.notes}</p>
      )}
      {a.status === "UNDER_REVIEW" && parsedScore !== null && parsedScore < PASS_MARK && <p className="text-sm text-warning">The test score is below the pass mark.</p>}
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {review && a.status === "SUBMITTED" && (
          <Button onClick={() => save("UNDER_REVIEW", "Moved to review")}>Start review</Button>
        )}
        {review && a.status === "UNDER_REVIEW" && (
          <>
            <Button variant="secondary" onClick={() => save("UNDER_REVIEW", "Saved")}>
              Save
            </Button>
            <Button variant="danger" onClick={() => save("REJECTED", `${a.name} rejected`)}>
              Reject
            </Button>
            <Button
              onClick={() => {
                if (parsedScore === null) return setError("Record the admission test score before accepting.");
                save("ACCEPTED", `${a.name} accepted`);
              }}
            >
              Accept
            </Button>
          </>
        )}
        {review && a.status === "REJECTED" && (
          <Button variant="secondary" onClick={() => save("UNDER_REVIEW", "Application reopened")}>
            Reopen
          </Button>
        )}
        {review && a.status === "ACCEPTED" && (
          <Button icon="graduation" onClick={() => setEnrolling(true)}>
            Enroll as student
          </Button>
        )}
        {a.status === "ENROLLED" && a.studentId && (
          <Button icon="user" onClick={() => onOpenStudent(a.studentId!)}>
            Open student record
          </Button>
        )}
      </FormActions>
    </div>
  );
}

function ApplicationForm({ onDone }: { onDone: () => void }) {
  const { db, update } = useDemo();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  if (!db) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const phone = normalizePhone(get("phone"));
    const guardianPhone = normalizePhone(get("guardianPhone"));
    const ssc = Number(get("sscGpa"));
    const hsc = Number(get("hscGpa"));
    const problems: string[] = [];
    if (get("name").length < 3) problems.push("Enter the applicant's full name.");
    if (!BD_PHONE.test(phone)) problems.push("Mobile must be a Bangladeshi number like 01712345678.");
    if (!(ssc >= 1 && ssc <= 5) || !(hsc >= 1 && hsc <= 5)) problems.push("SSC and HSC GPA must be between 1.00 and 5.00.");
    if (get("guardianName").length < 3) problems.push("Enter the guardian's name.");
    if (!BD_PHONE.test(guardianPhone)) problems.push("Guardian mobile must be a Bangladeshi number.");
    if (!get("dateOfBirth")) problems.push("Enter the date of birth.");
    if (problems.length) return setError(problems.join("\n"));
    let no = "";
    update((d) => {
      const year = Number(todayDhaka().slice(0, 4)) + 1;
      no = `ADM-${year}-${String(nextCounter(d, "application")).padStart(4, "0")}`;
      d.applications.push({
        id: newId(),
        applicationNo: no,
        name: get("name"),
        gender: get("gender") as Application["gender"],
        dateOfBirth: get("dateOfBirth"),
        phone,
        email: get("email") || null,
        programId: get("programId"),
        sscGpa: ssc,
        hscGpa: hsc,
        hscYear: Number(get("hscYear")) || year - 1,
        board: get("board"),
        guardianName: get("guardianName"),
        guardianRelation: get("guardianRelation") as Guardian["relation"],
        guardianPhone,
        division: get("division") || null,
        district: get("district") || null,
        status: "SUBMITTED",
        testScore: null,
        notes: null,
        appliedAt: nowIso(),
        decidedAt: null,
        studentId: null,
      });
    });
    toast(`Application ${no} created`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Applicant name" className="sm:col-span-2">
        <Input name="name" required autoFocus />
      </Field>
      <Field label="Gender">
        <Select name="gender">
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Date of birth">
        <Input name="dateOfBirth" type="date" required />
      </Field>
      <Field label="Mobile">
        <Input name="phone" inputMode="tel" placeholder="01XXXXXXXXX" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" />
      </Field>
      <Field label="Program" className="sm:col-span-2">
        <Select name="programId">
          {db.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="SSC GPA">
        <Input name="sscGpa" inputMode="decimal" placeholder="5.00" required />
      </Field>
      <Field label="HSC GPA">
        <Input name="hscGpa" inputMode="decimal" placeholder="5.00" required />
      </Field>
      <Field label="HSC board">
        <Select name="board">
          {BOARDS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </Field>
      <Field label="HSC year">
        <Input name="hscYear" inputMode="numeric" defaultValue={String(Number(todayDhaka().slice(0, 4)))} />
      </Field>
      <Field label="Guardian name">
        <Input name="guardianName" required />
      </Field>
      <Field label="Relation">
        <Select name="guardianRelation">
          {["Father", "Mother", "Brother", "Sister", "Uncle", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <Field label="Guardian mobile">
        <Input name="guardianPhone" inputMode="tel" required />
      </Field>
      <Field label="Division">
        <Select name="division">
          <option value="">—</option>
          {DIVISIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </Field>
      <Field label="District" className="sm:col-span-2">
        <Input name="district" />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create application</Button>
      </FormActions>
    </form>
  );
}
