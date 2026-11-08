"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, newId } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { Course, DemoDb, Department, Faculty, Program, Section, Semester, SemesterStatus } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, FilterSelect, opts, Tabs, Toolbar } from "@/components/demo";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

type Tab = "structure" | "courses" | "semesters" | "sections";

export default function AcademicsPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("sections");
  return (
    <>
      <PageHeader eyebrow="Academic" title="Academic setup" description="Faculties, departments, programs, courses, semesters and sections. The weekly timetable is under Class routine." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Programs" value={db.programs.length} sub={`in ${db.departments.length} departments`} icon="layers" />
            <StatCard label="Courses" value={db.courses.length} icon="book" />
            <StatCard label="Sections" value={db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status === "ONGOING").length} sub="this semester" icon="users" />
            <StatCard label="Teachers" value={db.teachers.length} icon="user" />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "sections", label: "Sections", count: db.sections.length },
              { key: "courses", label: "Courses", count: db.courses.length },
              { key: "semesters", label: "Semesters", count: db.semesters.length },
              { key: "structure", label: "Faculties & programs" },
            ]}
          />
          {tab === "structure" && <Structure db={db} />}
          {tab === "courses" && <Courses db={db} />}
          {tab === "semesters" && <Semesters db={db} />}
          {tab === "sections" && <Sections db={db} />}
        </>
      )}
    </>
  );
}

// ── Faculties, departments, programs ─────────────────────────────────────

function Structure({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const manage = can("academics.manage");
  const [modal, setModal] = useState<{ kind: "faculty"; item: Faculty | null } | { kind: "department"; item: Department | null; facultyId?: string } | { kind: "program"; item: Program | null; departmentId?: string } | null>(null);

  const close = () => setModal(null);
  const upsert = <K extends "faculties" | "departments" | "programs">(key: K, item: DemoDb[K][number] | null, values: Omit<DemoDb[K][number], "id">) => {
    update((d) => {
      const list = d[key] as { id: string }[];
      if (item) Object.assign(list.find((x) => x.id === item.id)!, values);
      else list.push({ id: newId(), ...values });
    });
    toast(item ? "Saved" : "Added");
    close();
  };

  return (
    <div className="space-y-5">
      {manage && (
        <div className="flex justify-end">
          <Button icon="plus" onClick={() => setModal({ kind: "faculty", item: null })}>
            Add faculty
          </Button>
        </div>
      )}
      {db.faculties.map((f) => (
        <Card
          key={f.id}
          title={
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold">{f.name}</h2>
              <Badge>{f.code}</Badge>
            </div>
          }
          actions={
            manage && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setModal({ kind: "faculty", item: f })}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setModal({ kind: "department", item: null, facultyId: f.id })}>
                  Department
                </Button>
              </div>
            )
          }
        >
          <div className="divide-y divide-border">
            {db.departments.filter((d) => d.facultyId === f.id).length === 0 && <p className="px-5 py-4 text-sm text-muted">No departments yet.</p>}
            {db.departments
              .filter((d) => d.facultyId === f.id)
              .map((d) => (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-accent-soft font-mono text-[11px] font-semibold text-accent">{d.code}</span>
                    <p className="flex-1 font-medium">Department of {d.name}</p>
                    <span className="text-xs text-muted">
                      {db.teachers.filter((t) => t.departmentId === d.id).length} teachers · {db.courses.filter((c) => c.departmentId === d.id).length} courses
                    </span>
                    {manage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setModal({ kind: "department", item: d })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon="plus" onClick={() => setModal({ kind: "program", item: null, departmentId: d.id })}>
                          Program
                        </Button>
                      </>
                    )}
                  </div>
                  {db.programs.some((p) => p.departmentId === d.id) && (
                    <ul className="mt-3 ml-10 space-y-1.5">
                      {db.programs
                        .filter((p) => p.departmentId === d.id)
                        .map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Icon name="graduation" className="size-4 text-subtle" />
                            <span>{p.name}</span>
                            <span className="text-xs text-muted">
                              {p.durationSemesters} semesters · {p.totalCredits} credits · {db.students.filter((s) => s.programId === p.id).length} students
                            </span>
                            {manage && (
                              <button onClick={() => setModal({ kind: "program", item: p })} className="text-xs text-accent hover:underline">
                                Edit
                              </button>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </Card>
      ))}

      <Modal open={modal?.kind === "faculty"} onClose={close} title={modal?.item ? "Edit faculty" : "Add faculty"}>
        {modal?.kind === "faculty" && (
          <EntityForm
            fields={[
              { name: "name", label: "Name", required: true, wide: true, defaultValue: modal.item?.name },
              { name: "code", label: "Code", required: true, defaultValue: modal.item?.code },
            ]}
            submitLabel="Save"
            onCancel={close}
            onSubmit={(v) => upsert("faculties", modal.item, { name: v.name!, code: v.code!.toUpperCase() })}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === "department"} onClose={close} title={modal?.item ? "Edit department" : "Add department"}>
        {modal?.kind === "department" && (
          <EntityForm
            fields={[
              { name: "name", label: "Name", required: true, wide: true, hint: "Without “Department of”", defaultValue: modal.item?.name },
              { name: "code", label: "Code", required: true, hint: "Used in student IDs", defaultValue: modal.item?.code },
              { name: "facultyId", label: "Faculty", type: "select", options: opts(db.faculties, (f) => f.name), defaultValue: modal.item?.facultyId ?? modal.facultyId },
            ]}
            submitLabel="Save"
            onCancel={close}
            onSubmit={(v) => {
              if (db.departments.some((d) => d.code.toUpperCase() === v.code!.toUpperCase() && d.id !== modal.item?.id)) return "Another department already uses this code.";
              upsert("departments", modal.item, { name: v.name!, code: v.code!.toUpperCase(), facultyId: v.facultyId! });
            }}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === "program"} onClose={close} title={modal?.item ? "Edit program" : "Add program"}>
        {modal?.kind === "program" && (
          <EntityForm
            fields={[
              { name: "name", label: "Name", required: true, wide: true, defaultValue: modal.item?.name },
              { name: "code", label: "Code", required: true, defaultValue: modal.item?.code },
              { name: "departmentId", label: "Department", type: "select", options: opts(db.departments, (d) => d.name), defaultValue: modal.item?.departmentId ?? modal.departmentId },
              { name: "degree", label: "Degree", type: "select", options: [{ value: "BACHELOR", label: "Bachelor" }, { value: "MASTER", label: "Master" }, { value: "DIPLOMA", label: "Diploma" }], defaultValue: modal.item?.degree },
              { name: "durationSemesters", label: "Semesters", type: "number", required: true, defaultValue: modal.item?.durationSemesters ?? 8 },
              { name: "totalCredits", label: "Total credits", type: "number", required: true, defaultValue: modal.item?.totalCredits ?? 140 },
            ]}
            submitLabel="Save"
            onCancel={close}
            onSubmit={(v) => {
              const sem = Number(v.durationSemesters);
              const credits = Number(v.totalCredits);
              if (!(sem > 0 && credits > 0)) return "Semesters and credits must be positive numbers.";
              upsert("programs", modal.item, { name: v.name!, code: v.code!.toUpperCase(), departmentId: v.departmentId!, degree: v.degree as Program["degree"], durationSemesters: sem, totalCredits: credits });
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Courses ──────────────────────────────────────────────────────────────

function Courses({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const manage = can("academics.manage");
  const rows = db.courses.filter((c) => !dept || c.departmentId === dept).sort((a, b) => a.code.localeCompare(b.code));
  const inUse = (id: string) => db.sections.some((s) => s.courses.some((c) => c.courseId === id));
  const item = editing === "new" ? null : editing;

  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Department" value={dept} onChange={setDept}>
          <option value="">All departments</option>
          {db.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{rows.length} courses · {rows.reduce((s, c) => s + c.credits, 0)} credits</span>
        {manage && (
          <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
            Add course
          </Button>
        )}
      </Toolbar>
      <Table head={["Code", "Title", "Department", "Credits", "Type", "Sections", ""]} empty={!rows.length && <EmptyState icon="book" title="No courses" />}>
        {rows.map((c) => (
          <Tr key={c.id}>
            <Td>
              <code className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-xs">{c.code}</code>
            </Td>
            <Td className="font-medium">{c.title}</Td>
            <Td className="text-muted">{lookup(db.departments, c.departmentId)?.code}</Td>
            <Td className="tabular-nums">{c.credits}</Td>
            <Td>{c.type === "LAB" ? <Badge tone="warning">Lab</Badge> : <Badge>Theory</Badge>}</Td>
            <Td className="text-muted tabular-nums">{db.sections.filter((s) => s.courses.some((x) => x.courseId === c.id)).length}</Td>
            <Td className="text-right whitespace-nowrap">
              {manage && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={inUse(c.id)}
                    title={inUse(c.id) ? "Taught in a section, so it can't be deleted" : undefined}
                    onClick={() => {
                      if (!window.confirm(`Delete ${c.code}?`)) return;
                      update((d) => {
                        d.courses = d.courses.filter((x) => x.id !== c.id);
                      });
                      toast(`${c.code} deleted`);
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? `Edit ${item.code}` : "Add course"}>
        <EntityForm
          fields={[
            { name: "code", label: "Code", required: true, defaultValue: item?.code, hint: "e.g. CSE303" },
            { name: "credits", label: "Credits", type: "number", required: true, defaultValue: item?.credits ?? 3 },
            { name: "title", label: "Title", required: true, wide: true, defaultValue: item?.title },
            { name: "departmentId", label: "Department", type: "select", options: opts(db.departments, (d) => d.name), defaultValue: item?.departmentId ?? (dept || undefined) },
            { name: "type", label: "Type", type: "select", options: [{ value: "THEORY", label: "Theory" }, { value: "LAB", label: "Lab" }], defaultValue: item?.type },
          ]}
          submitLabel={item ? "Save changes" : "Add course"}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            const code = v.code!.toUpperCase().replace(/\s+/g, "");
            const credits = Number(v.credits);
            if (!(credits > 0 && credits <= 6)) return "Credits must be between 0.5 and 6.";
            if (db.courses.some((c) => c.code === code && c.id !== item?.id)) return `${code} already exists.`;
            const values = { code, title: v.title!, credits, departmentId: v.departmentId!, type: v.type as Course["type"] };
            update((d) => {
              if (item) Object.assign(d.courses.find((c) => c.id === item.id)!, values);
              else d.courses.push({ id: newId(), ...values });
            });
            toast(item ? "Course updated" : `${code} added`);
            setEditing(null);
          }}
        />
      </Modal>
    </Card>
  );
}

// ── Semesters ────────────────────────────────────────────────────────────

const SEMESTER_TONE: Record<SemesterStatus, "success" | "neutral" | "accent"> = { ONGOING: "success", COMPLETED: "neutral", UPCOMING: "accent" };

function Semesters({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [editing, setEditing] = useState<Semester | "new" | null>(null);
  const manage = can("academics.manage");
  const item = editing === "new" ? null : editing;
  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">Only one semester can be ongoing at a time.</span>
        {manage && (
          <Button size="sm" icon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Add semester
          </Button>
        )}
      </Toolbar>
      <Table head={["Semester", "Starts", "Ends", "Sections", "Status", ""]}>
        {[...db.semesters]
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
          .map((s) => (
            <Tr key={s.id}>
              <Td className="font-medium">{s.name}</Td>
              <Td className="text-muted">{formatDate(s.startDate)}</Td>
              <Td className="text-muted">{formatDate(s.endDate)}</Td>
              <Td className="tabular-nums">{db.sections.filter((x) => x.semesterId === s.id).length}</Td>
              <Td>
                <Badge tone={SEMESTER_TONE[s.status]} dot>
                  {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                </Badge>
              </Td>
              <Td className="text-right">
                {manage && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? `Edit ${item.name}` : "Add semester"}>
        <EntityForm
          fields={[
            { name: "name", label: "Name", required: true, wide: true, defaultValue: item?.name, hint: "e.g. Spring 2027" },
            { name: "startDate", label: "Starts", type: "date", required: true, defaultValue: item?.startDate },
            { name: "endDate", label: "Ends", type: "date", required: true, defaultValue: item?.endDate },
            { name: "status", label: "Status", type: "select", options: ["UPCOMING", "ONGOING", "COMPLETED"].map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase() })), defaultValue: item?.status },
          ]}
          submitLabel="Save"
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            if (v.endDate! <= v.startDate!) return "The semester must end after it starts.";
            const values = { name: v.name!, startDate: v.startDate!, endDate: v.endDate!, status: v.status as SemesterStatus };
            update((d) => {
              // Making one semester ongoing completes the previous ongoing one.
              if (values.status === "ONGOING") d.semesters.forEach((s) => s.status === "ONGOING" && s.id !== item?.id && (s.status = "COMPLETED"));
              if (item) Object.assign(d.semesters.find((s) => s.id === item.id)!, values);
              else d.semesters.push({ id: newId(), ...values });
            });
            toast(item ? "Semester updated" : `${values.name} added`);
            setEditing(null);
          }}
        />
      </Modal>
    </Card>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

function Sections({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const [semester, setSemester] = useState(db.semesters.find((s) => s.status === "ONGOING")?.id ?? "");
  const [editing, setEditing] = useState<Section | "new" | null>(null);
  const manage = can("academics.manage");
  const rows = db.sections.filter((s) => !semester || s.semesterId === semester);
  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Semester" value={semester} onChange={setSemester}>
          <option value="">All semesters</option>
          {db.semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        {manage && (
          <Button size="sm" icon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Add section
          </Button>
        )}
      </Toolbar>
      <Table head={["Section", "Program", "Semester", "Room", "Students", "Courses & teachers", ""]} empty={!rows.length && <EmptyState icon="users" title="No sections in this semester" />}>
        {rows.map((s) => (
          <Tr key={s.id}>
            <Td>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted">Batch {s.batch}</p>
            </Td>
            <Td className="text-muted">{lookup(db.programs, s.programId)?.code}</Td>
            <Td className="text-muted">{lookup(db.semesters, s.semesterId)?.name}</Td>
            <Td className="font-mono text-xs">{s.room}</Td>
            <Td className="tabular-nums">{db.students.filter((x) => x.sectionId === s.id).length}</Td>
            <Td>
              <ul className="space-y-0.5 text-xs">
                {s.courses.map((c) => (
                  <li key={c.courseId}>
                    <span className="font-mono">{lookup(db.courses, c.courseId)?.code}</span> <span className="text-muted">· {lookup(db.teachers, c.teacherId)?.name ?? "No teacher"}</span>
                  </li>
                ))}
              </ul>
            </Td>
            <Td className="text-right">
              {manage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== "new" ? `Edit ${editing.name}` : "Add section"} size="lg">
        {editing !== null && <SectionForm db={db} section={editing === "new" ? null : editing} defaultSemester={semester} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function SectionForm({ db, section, defaultSemester, onDone }: { db: DemoDb; section: Section | null; defaultSemester: string; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState(section?.programId ?? db.programs[0]?.id ?? "");
  const [courses, setCourses] = useState(section?.courses ?? []);
  const deptId = lookup(db.programs, programId)?.departmentId;
  const available = db.courses.filter((c) => !courses.some((x) => x.courseId === c.id)).sort((a, b) => Number(b.departmentId === deptId) - Number(a.departmentId === deptId) || a.code.localeCompare(b.code));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    if (!f.name || !f.batch || !f.room) return setError("Name, batch and room are required.");
    if (db.sections.some((s) => s.name.toLowerCase() === f.name!.toLowerCase() && s.semesterId === f.semesterId && s.id !== section?.id)) return setError("A section with this name already exists in that semester.");
    if (!courses.length) return setError("Add at least one course.");
    const values = { name: f.name.toUpperCase(), batch: f.batch, room: f.room, programId, semesterId: f.semesterId!, courses };
    update((d) => {
      if (section) {
        Object.assign(d.sections.find((s) => s.id === section.id)!, values);
        // Keep routine teachers in step with the course assignments.
        d.routine.forEach((r) => {
          if (r.sectionId !== section.id) return;
          const c = courses.find((x) => x.courseId === r.courseId);
          if (c) r.teacherId = c.teacherId;
        });
        d.routine = d.routine.filter((r) => r.sectionId !== section.id || courses.some((c) => c.courseId === r.courseId));
      } else d.sections.push({ id: newId(), ...values });
    });
    toast(section ? "Section updated" : `${values.name} created`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Section name" hint="e.g. CSE-62A">
        <Input name="name" defaultValue={section?.name} required autoFocus className="uppercase" />
      </Field>
      <Field label="Program">
        <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {db.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Semester">
        <Select name="semesterId" defaultValue={section?.semesterId ?? (defaultSemester || db.semesters[0]?.id)}>
          {db.semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Batch">
        <Input name="batch" defaultValue={section?.batch} required />
      </Field>
      <Field label="Home room" className="sm:col-span-2">
        <Input name="room" defaultValue={section?.room} required placeholder="e.g. AB1-301" />
      </Field>
      <div className="col-span-full">
        <p className="mb-2 text-[13px] font-medium">Courses and teachers</p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {courses.length === 0 && <p className="px-4 py-3 text-sm text-muted">No courses yet.</p>}
          {courses.map((c, i) => {
            const course = lookup(db.courses, c.courseId)!;
            return (
              <div key={c.courseId} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="w-20 font-mono text-xs">{course.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{course.title}</span>
                <select
                  aria-label={`Teacher for ${course.code}`}
                  value={c.teacherId ?? ""}
                  onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, teacherId: e.target.value || null } : x)))}
                  className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-sm"
                >
                  <option value="">No teacher</option>
                  {db.teachers
                    .slice()
                    .sort((a, b) => Number(b.departmentId === course.departmentId) - Number(a.departmentId === course.departmentId))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({lookup(db.departments, t.departmentId)?.code})
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => setCourses(courses.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-danger" aria-label={`Remove ${course.code}`}>
                  <Icon name="x" className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <select
          aria-label="Add course"
          value=""
          onChange={(e) => e.target.value && setCourses([...courses, { courseId: e.target.value, teacherId: null }])}
          className="mt-2 h-9 w-full rounded-lg border border-dashed border-border-strong bg-surface px-2.5 text-sm text-muted"
        >
          <option value="">+ Add a course…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.title} ({c.credits} cr)
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-subtle">{courses.reduce((s, c) => s + (lookup(db.courses, c.courseId)?.credits ?? 0), 0)} credits this semester</p>
      </div>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{section ? "Save changes" : "Create section"}</Button>
      </FormActions>
    </form>
  );
}

