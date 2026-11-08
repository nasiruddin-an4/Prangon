"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BD_PHONE, downloadCsv, generateStudentId, lookup, newId, normalizePhone, nowIso, parseCsv, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { Guardian, Student } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, Toolbar, useStudentIdFormat } from "@/components/demo";
import { programLine, STATUS_TONE, statusLabel, StudentForm, StudentProfile } from "@/components/students";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, FormActions, IconButton, Modal, PageHeader, Pagination, SearchInput, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

const PAGE_SIZE = 15;

export default function StudentsPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Students"
        description="Every enrolled student with their program, section, guardians, attendance, results and fees. Guardians have their own page."
        actions={
          <>
            <DemoNotice />
            {can("students.import") && (
              <Button variant="secondary" icon="refresh" onClick={() => setImporting(true)}>
                Import CSV
              </Button>
            )}
            {can("students.manage") && (
              <Button icon="plus" onClick={() => setAdding(true)}>
                Add student
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
            <StatCard label="Students" value={db.students.length} icon="graduation" />
            <StatCard label="Active" value={db.students.filter((s) => s.status === "ACTIVE").length} icon="check" />
            <StatCard label="Female" value={`${Math.round((db.students.filter((s) => s.gender === "FEMALE").length / Math.max(1, db.students.length)) * 100)}%`} icon="users" />
            <StatCard label="Guardians" value={db.guardians.length} icon="user" />
          </div>
<StudentList onOpen={setProfile} onAdd={() => setAdding(true)} />
        </>
      )}

      <StudentProfile studentId={profile} onClose={() => setProfile(null)} />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add student" description="The student ID is generated from the format in Settings." size="lg">
        <StudentForm student={null} onDone={() => setAdding(false)} onCreated={(id) => setProfile(id)} />
      </Modal>
      <Modal open={importing} onClose={() => setImporting(false)} title="Import students from CSV" size="lg">
        <ImportStudents onDone={() => setImporting(false)} />
      </Modal>
    </>
  );
}

function StudentList({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { can } = useAuth();
  const { db } = useDemo();
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    if (!db) return [];
    const q = query.trim().toLowerCase();
    return db.students
      .filter(
        (s) =>
          (!q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.phone.includes(q)) &&
          (!program || s.programId === program) &&
          (!section || s.sectionId === section) &&
          (!status || s.status === status),
      )
      .sort((a, b) => a.studentId.localeCompare(b.studentId));
  }, [db, query, program, section, status]);

  if (!db) return null;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const exportCsv = () =>
    downloadCsv(`students-${todayDhaka()}.csv`, [
      ["Student ID", "Name", "Gender", "Date of birth", "Mobile", "Email", "Program", "Section", "Batch", "Status", "Guardian", "Guardian mobile", "District"],
      ...rows.map((s) => {
        const g = lookup(db.guardians, s.guardianIds[0]);
        return [s.studentId, s.name, s.gender, s.dateOfBirth, s.phone, s.email, lookup(db.programs, s.programId)?.code, lookup(db.sections, s.sectionId)?.name, s.batch, s.status, g?.name, g?.phone, s.district];
      }),
    ]);

  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={filter(setQuery)} placeholder="Search name, ID or mobile" />
        <FilterSelect label="Program" value={program} onChange={filter((v: string) => { setProgram(v); setSection(""); })}>
          <option value="">All programs</option>
          {db.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Section" value={section} onChange={filter(setSection)}>
          <option value="">All sections</option>
          {db.sections
            .filter((s) => !program || s.programId === program)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </FilterSelect>
        <FilterSelect label="Status" value={status} onChange={filter(setStatus)}>
          <option value="">Any status</option>
          {(["ACTIVE", "SUSPENDED", "GRADUATED", "DROPPED"] as const).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{rows.length} students</span>
        <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </Button>
      </Toolbar>
      <Table
        head={["Student", "Program", "Mobile", "Guardian", "Status", ""]}
        empty={
          !visible.length && (
            <EmptyState
              icon="graduation"
              title={db.students.length ? "No students match" : "No students yet"}
              description={db.students.length ? "Try a different search or filter." : "Add students one by one, import a CSV, or enroll accepted applicants."}
              action={!db.students.length && can("students.manage") && <Button icon="plus" onClick={onAdd}>Add student</Button>}
            />
          )
        }
      >
        {visible.map((s) => {
          const g = lookup(db.guardians, s.guardianIds[0]);
          return (
            <Tr key={s.id}>
              <Td>
                <button onClick={() => onOpen(s.id)} className="flex items-center gap-3 text-left">
                  <Avatar name={s.name} />
                  <span>
                    <span className="block font-medium hover:text-accent">{s.name}</span>
                    <span className="block font-mono text-xs text-muted">{s.studentId}</span>
                  </span>
                </button>
              </Td>
              <Td className="text-muted">{programLine(db, s) || "—"}</Td>
              <Td className="text-muted tabular-nums">{s.phone}</Td>
              <Td className="text-muted">{g ? `${g.name} (${g.relation})` : "—"}</Td>
              <Td>
                <Badge tone={STATUS_TONE[s.status]} dot>
                  {statusLabel(s.status)}
                </Badge>
              </Td>
              <Td className="text-right">
                <IconButton icon="eye" label="View" onClick={() => onOpen(s.id)} />
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Pagination page={current} pages={pages} onPage={setPage} />
    </Card>
  );
}

// ── CSV import ───────────────────────────────────────────────────────────

const TEMPLATE_HEADER = ["name", "gender", "date_of_birth", "mobile", "email", "program_code", "section", "admission_date", "guardian_name", "guardian_relation", "guardian_mobile"];

interface ParsedRow {
  line: number;
  values: Record<string, string>;
  errors: string[];
}

function ImportStudents({ onDone }: { onDone: () => void }) {
  const { db, update } = useDemo();
  const toast = useToast();
  const idFormat = useStudentIdFormat();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!db) return null;

  const downloadTemplate = () =>
    downloadCsv("student-import-template.csv", [
      TEMPLATE_HEADER,
      ["Rahim Uddin", "MALE", "2007-04-15", "01712345678", "rahim@example.com", "BSC-CSE", "CSE-61A", todayDhaka(), "Karim Uddin", "Father", "01812345678"],
    ]);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file || !db) return;
    const table = parseCsv(await file.text());
    const [header, ...body] = table;
    if (!header) return setError("The file is empty.");
    const keys = header.map((h) => h.trim().toLowerCase());
    const missing = TEMPLATE_HEADER.filter((k) => !keys.includes(k) && k !== "email");
    if (missing.length) return setError(`Missing columns: ${missing.join(", ")}. Download the template to see the expected format.`);
    setRows(
      body.map((cells, i) => {
        const values = Object.fromEntries(keys.map((k, j) => [k, (cells[j] ?? "").trim()]));
        const errors: string[] = [];
        if (values.name!.length < 3) errors.push("name is missing");
        if (!["MALE", "FEMALE", "OTHER"].includes(values.gender!.toUpperCase())) errors.push("gender must be MALE, FEMALE or OTHER");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth!)) errors.push("date_of_birth must be YYYY-MM-DD");
        if (!BD_PHONE.test(normalizePhone(values.mobile!))) errors.push("mobile isn't a Bangladeshi number");
        if (!db.programs.some((p) => p.code.toLowerCase() === values.program_code!.toLowerCase())) errors.push(`unknown program "${values.program_code}"`);
        if (values.section && !db.sections.some((s) => s.name.toLowerCase() === values.section!.toLowerCase())) errors.push(`unknown section "${values.section}"`);
        if (!BD_PHONE.test(normalizePhone(values.guardian_mobile!))) errors.push("guardian_mobile isn't a Bangladeshi number");
        if (db.students.some((s) => s.phone === normalizePhone(values.mobile!))) errors.push("a student with this mobile already exists");
        return { line: i + 2, values, errors };
      }),
    );
  }

  const valid = rows?.filter((r) => !r.errors.length) ?? [];

  function importRows() {
    update((d) => {
      for (const { values: v } of valid) {
        const program = d.programs.find((p) => p.code.toLowerCase() === v.program_code!.toLowerCase())!;
        const dept = lookup(d.departments, program.departmentId)!;
        const section = d.sections.find((s) => s.name.toLowerCase() === (v.section ?? "").toLowerCase());
        const admissionDate = /^\d{4}-\d{2}-\d{2}$/.test(v.admission_date ?? "") ? v.admission_date! : todayDhaka();
        const guardian: Guardian = {
          id: newId(),
          name: v.guardian_name || "Guardian",
          relation: (["Father", "Mother", "Brother", "Sister", "Uncle", "Other"].find((r) => r.toLowerCase() === (v.guardian_relation ?? "").toLowerCase()) ?? "Other") as Guardian["relation"],
          phone: normalizePhone(v.guardian_mobile!),
          email: null,
          occupation: null,
        };
        d.guardians.push(guardian);
        const student: Student = {
          id: newId(),
          studentId: generateStudentId(d, idFormat, { year: Number(admissionDate.slice(0, 4)), dept: dept.code, campus: null }),
          name: v.name!,
          gender: v.gender!.toUpperCase() as Student["gender"],
          dateOfBirth: v.date_of_birth!,
          bloodGroup: null,
          phone: normalizePhone(v.mobile!),
          email: v.email || null,
          programId: program.id,
          sectionId: section?.id ?? null,
          batch: section?.batch ?? "—",
          campus: null,
          admissionDate,
          status: "ACTIVE",
          division: null,
          district: null,
          address: null,
          guardianIds: [guardian.id],
          createdAt: nowIso(),
        };
        d.students.push(student);
      }
    });
    toast(`Imported ${valid.length} student${valid.length === 1 ? "" : "s"}`);
    onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Upload a CSV with one student per row. Rows with problems are skipped; fix them and import again. Student IDs are generated automatically.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent" />
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          Download template
        </Button>
      </div>
      <ErrorNote message={error} />
      {rows && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex gap-4 border-b border-border bg-surface-2/60 px-4 py-2.5 text-sm">
            <span className="text-success">{valid.length} ready</span>
            <span className={rows.length - valid.length ? "text-danger" : "text-muted"}>{rows.length - valid.length} with problems</span>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
            {rows.map((r) => (
              <li key={r.line} className="flex gap-3 px-4 py-2">
                <span className="w-12 shrink-0 text-xs text-subtle">Line {r.line}</span>
                <span className="w-44 shrink-0 truncate font-medium">{r.values.name || "—"}</span>
                <span className={r.errors.length ? "text-danger" : "text-success"}>{r.errors.length ? r.errors.join("; ") : "OK"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!valid.length} onClick={importRows}>
          Import {valid.length || ""} students
        </Button>
      </FormActions>
    </div>
  );
}
