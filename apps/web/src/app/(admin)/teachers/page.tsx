"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { BD_PHONE, downloadCsv, lookup, newId, normalizePhone, todayDhaka, WEEKDAYS } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Staff, StaffStatus, Teacher } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, FilterSelect, InfoGrid, opts, Tabs, Toolbar } from "@/components/demo";
import { Avatar, Badge, Button, Card, EmptyState, FormActions, formatDate, Modal, PageHeader, SearchInput, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

const DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Lecturer"] as const;
const STAFF_STATUS: Record<StaffStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  ON_LEAVE: { label: "On leave", tone: "warning" },
  RESIGNED: { label: "Resigned", tone: "neutral" },
};
/** Initials without honorifics, so "Dr. Abu Sayeed" becomes "AS". */
const plainName = (name: string) => name.replace(/^(Dr\.|Md\.|Prof\.)\s+/g, "");

export default function TeachersPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<"teachers" | "staff">("teachers");
  return (
    <>
      <PageHeader eyebrow="People" title="Teachers & staff" description="Faculty members with their courses and weekly load, and the non-teaching staff who run the offices." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Teachers" value={db.teachers.length} icon="user" />
            <StatCard label="PhD holders" value={db.teachers.filter((t) => t.name.startsWith("Dr.")).length} icon="graduation" />
            <StatCard label="Staff" value={db.staff.filter((s) => s.status !== "RESIGNED").length} icon="users" />
            <StatCard label="Student : teacher" value={`${Math.round(db.students.filter((s) => s.status === "ACTIVE").length / Math.max(1, db.teachers.length))} : 1`} icon="chart" />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "teachers", label: "Teachers", count: db.teachers.length },
              { key: "staff", label: "Staff", count: db.staff.length },
            ]}
          />
          {tab === "teachers" ? <Teachers db={db} /> : <StaffList db={db} />}
        </>
      )}
    </>
  );
}

// ── Teachers ─────────────────────────────────────────────────────────────

function Teachers({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  const [profile, setProfile] = useState<Teacher | null>(null);
  const manage = can("teachers.manage") || can("academics.manage");
  const item = editing === "new" ? null : editing;
  const q = query.trim().toLowerCase();
  const rows = db.teachers.filter((t) => (!dept || t.departmentId === dept) && (!q || t.name.toLowerCase().includes(q) || t.email.includes(q)));
  const coursesOf = (id: string) => db.sections.flatMap((s) => s.courses.filter((c) => c.teacherId === id).map((c) => ({ section: s, course: lookup(db.courses, c.courseId)! })));
  const load = (id: string) => db.routine.filter((r) => r.teacherId === id).length;

  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" />
        <FilterSelect label="Department" value={dept} onChange={setDept}>
          <option value="">All departments</option>
          {db.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </FilterSelect>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              downloadCsv(`teachers-${todayDhaka()}.csv`, [
                ["Name", "Designation", "Department", "Email", "Mobile", "Courses", "Weekly classes"],
                ...rows.map((t) => [t.name, t.designation, lookup(db.departments, t.departmentId)?.code, t.email, t.phone, coursesOf(t.id).map((c) => `${c.course.code} (${c.section.name})`).join("; "), load(t.id)]),
              ])
            }
          >
            Export CSV
          </Button>
          {manage && (
            <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
              Add teacher
            </Button>
          )}
        </div>
      </Toolbar>
      <Table head={["Teacher", "Department", "Courses", "Weekly classes", "Contact", ""]} empty={!rows.length && <EmptyState icon="user" title="No teachers match" />}>
        {rows.map((t) => {
          const courses = coursesOf(t.id);
          return (
            <Tr key={t.id}>
              <Td>
                <button onClick={() => setProfile(t)} className="flex items-center gap-3 text-left">
                  <Avatar name={plainName(t.name)} />
                  <span>
                    <span className="block font-medium hover:text-accent">{t.name}</span>
                    <span className="block text-xs text-muted">{t.designation}</span>
                  </span>
                </button>
              </Td>
              <Td className="text-muted">{lookup(db.departments, t.departmentId)?.code}</Td>
              <Td className="max-w-64 text-xs text-muted">{courses.map((c) => `${c.course.code} (${c.section.name})`).join(", ") || "—"}</Td>
              <Td className="tabular-nums">{load(t.id)}</Td>
              <Td className="text-xs text-muted">
                <p>{t.email}</p>
                <p className="tabular-nums">{t.phone}</p>
              </Td>
              <Td className="text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => setProfile(t)}>
                  View
                </Button>
                {manage && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>

      <Modal open={!!profile} onClose={() => setProfile(null)} title={profile?.name ?? ""} description={profile ? `${profile.designation} · Department of ${lookup(db.departments, profile.departmentId)?.name}` : undefined} size="lg">
        {profile && (
          <TeacherProfile
            db={db}
            teacher={profile}
            onClose={() => setProfile(null)}
            onRemove={
              manage && !coursesOf(profile.id).length
                ? () => {
                    if (!window.confirm(`Remove ${profile.name}?`)) return;
                    update((d) => {
                      d.teachers = d.teachers.filter((x) => x.id !== profile.id);
                    });
                    toast(`${profile.name} removed`);
                    setProfile(null);
                  }
                : undefined
            }
          />
        )}
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? "Edit teacher" : "Add teacher"}>
        <EntityForm
          fields={[
            { name: "name", label: "Name", required: true, wide: true, defaultValue: item?.name, hint: "With title, e.g. Dr. Farhana Yasmin" },
            { name: "designation", label: "Designation", type: "select", options: DESIGNATIONS.map((x) => ({ value: x, label: x })), defaultValue: item?.designation ?? "Lecturer" },
            { name: "departmentId", label: "Department", type: "select", options: opts(db.departments, (d) => d.name), defaultValue: item?.departmentId ?? (dept || undefined) },
            { name: "email", label: "Email", required: true, defaultValue: item?.email },
            { name: "phone", label: "Mobile", required: true, defaultValue: item?.phone },
          ]}
          submitLabel={item ? "Save changes" : "Add teacher"}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            const phone = normalizePhone(v.phone!);
            if (!/^\S+@\S+\.\S+$/.test(v.email!)) return "Email address isn't valid.";
            if (!BD_PHONE.test(phone)) return "Mobile must be a Bangladeshi number like 01712345678.";
            if (db.teachers.some((t) => t.email.toLowerCase() === v.email!.toLowerCase() && t.id !== item?.id)) return "Another teacher already uses this email.";
            const values = { name: v.name!, designation: v.designation as Teacher["designation"], departmentId: v.departmentId!, email: v.email!, phone };
            update((d) => {
              if (item) Object.assign(d.teachers.find((t) => t.id === item.id)!, values);
              else d.teachers.push({ id: newId(), ...values });
            });
            toast(item ? "Teacher updated" : `${values.name} added`);
            setEditing(null);
          }}
        />
      </Modal>
    </Card>
  );
}

function TeacherProfile({ db, teacher, onClose, onRemove }: { db: DemoDb; teacher: Teacher; onClose: () => void; onRemove?: () => void }) {
  const slots = db.routine.filter((r) => r.teacherId === teacher.id);
  const courses = db.sections.flatMap((s) => s.courses.filter((c) => c.teacherId === teacher.id).map((c) => ({ section: s, course: lookup(db.courses, c.courseId)! })));
  const students = new Set(courses.flatMap((c) => db.students.filter((s) => s.sectionId === c.section.id).map((s) => s.id))).size;
  const credits = courses.reduce((s, c) => s + c.course.credits, 0);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={plainName(teacher.name)} />
        <InfoGrid
          items={[
            ["Email", <a key="e" href={`mailto:${teacher.email}`} className="text-accent">{teacher.email}</a>],
            ["Mobile", <a key="p" href={`tel:${teacher.phone}`} className="text-accent">{teacher.phone}</a>],
          ]}
        />
      </div>
      <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border text-center">
        {[
          ["Courses", courses.length],
          ["Credit hours", credits],
          ["Students taught", students],
        ].map(([label, value]) => (
          <div key={label} className="px-3 py-3">
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Courses this semester</h3>
        {courses.length === 0 ? (
          <p className="text-sm text-muted">Not assigned to any course. Assign courses under Academic setup → Sections.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {courses.map((c) => (
              <li key={`${c.section.id}-${c.course.id}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 font-mono text-xs">{c.course.code}</span>
                <span className="flex-1 truncate">{c.course.title}</span>
                <Badge>{c.section.name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Weekly timetable · {slots.length} classes</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {WEEKDAYS.map((d) => {
            const day = slots.filter((s) => s.day === d.key).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={d.key} className="rounded-xl border border-border p-3">
                <p className="mb-1.5 text-xs font-semibold text-muted">{d.label}</p>
                {day.length === 0 ? (
                  <p className="text-xs text-subtle">No classes</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {day.map((s) => (
                      <li key={s.id}>
                        <span className="tabular-nums text-muted">{s.start}</span> <span className="font-mono font-medium">{lookup(db.courses, s.courseId)?.code}</span>{" "}
                        <span className="text-muted">
                          {lookup(db.sections, s.sectionId)?.name} · {s.room}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <FormActions>
        {onRemove && (
          <Button variant="ghost" onClick={onRemove} className="mr-auto text-danger">
            Remove teacher
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </FormActions>
    </div>
  );
}

// ── Staff ────────────────────────────────────────────────────────────────

function StaffList({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [office, setOffice] = useState("");
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const manage = can("teachers.manage");
  const offices = [...new Set(db.staff.map((s) => s.office))].sort();
  const rows = db.staff.filter((s) => !office || s.office === office).sort((a, b) => a.office.localeCompare(b.office) || a.name.localeCompare(b.name));
  const item = editing === "new" ? null : editing;

  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Office" value={office} onChange={setOffice}>
          <option value="">All offices</option>
          {offices.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{rows.length} people</span>
        {manage && (
          <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
            Add staff
          </Button>
        )}
      </Toolbar>
      <Table head={["Name", "Office", "Joined", "Contact", "Status", ""]} empty={!rows.length && <EmptyState icon="users" title="No staff yet" />}>
        {rows.map((s) => (
          <Tr key={s.id}>
            <Td>
              <div className="flex items-center gap-3">
                <Avatar name={plainName(s.name)} size="sm" />
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">{s.designation}</p>
                </div>
              </div>
            </Td>
            <Td className="text-muted">{s.office}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDate(s.joinedOn)}</Td>
            <Td className="text-xs text-muted">
              <p>{s.email}</p>
              <p className="tabular-nums">{s.phone}</p>
            </Td>
            <Td>
              <Badge tone={STAFF_STATUS[s.status].tone} dot>
                {STAFF_STATUS[s.status].label}
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
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? "Edit staff member" : "Add staff member"}>
        <EntityForm
          fields={[
            { name: "name", label: "Name", required: true, wide: true, defaultValue: item?.name },
            { name: "designation", label: "Designation", required: true, defaultValue: item?.designation, hint: "e.g. Accounts Officer" },
            { name: "office", label: "Office", required: true, defaultValue: item?.office, hint: "e.g. Accounts, Library, IT" },
            { name: "email", label: "Email", required: true, defaultValue: item?.email },
            { name: "phone", label: "Mobile", required: true, defaultValue: item?.phone },
            { name: "joinedOn", label: "Joined", type: "date", required: true, defaultValue: item?.joinedOn },
            { name: "status", label: "Status", type: "select", options: (Object.keys(STAFF_STATUS) as StaffStatus[]).map((k) => ({ value: k, label: STAFF_STATUS[k].label })), defaultValue: item?.status ?? "ACTIVE" },
          ]}
          submitLabel={item ? "Save changes" : "Add staff member"}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            const phone = normalizePhone(v.phone!);
            if (!/^\S+@\S+\.\S+$/.test(v.email!)) return "Email address isn't valid.";
            if (!BD_PHONE.test(phone)) return "Mobile must be a Bangladeshi number like 01712345678.";
            if (v.joinedOn! > todayDhaka()) return "The joining date can't be in the future.";
            const values = { name: v.name!, designation: v.designation!, office: v.office!, email: v.email!, phone, joinedOn: v.joinedOn!, status: v.status as StaffStatus };
            update((d) => {
              if (item) Object.assign(d.staff.find((s) => s.id === item.id)!, values);
              else d.staff.push({ id: newId(), ...values });
            });
            toast(item ? "Staff member updated" : `${values.name} added`);
            setEditing(null);
          }}
        />
      </Modal>
    </Card>
  );
}
