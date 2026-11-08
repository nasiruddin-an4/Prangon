"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, newId, PERIODS, routineClash, todayDhaka, WEEKDAYS } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, RoutineSlot, Section, Weekday } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, PrintButton, Toolbar } from "@/components/demo";
import { Icon } from "@/components/icons";
import { Button, Card, cx, ErrorNote, Field, FormActions, Input, Modal, PageHeader, Select, StatCard, useToast } from "@/components/ui";

export default function RoutinePage() {
  const { db } = useDemo();
  return (
    <>
      <PageHeader eyebrow="Academic" title="Class routine" description="The weekly timetable for every section and teacher, Saturday to Thursday. New classes are checked for section, teacher and room clashes." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <TodayStrip db={db} />
          <Routine db={db} />
        </>
      )}
    </>
  );
}

/** How many classes run today and which one is on now. */
function TodayStrip({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const wd = (["SUN", "MON", "TUE", "WED", "THU", null, "SAT"] as const)[new Date(`${today}T00:00:00Z`).getUTCDay()] ?? null;
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date());
  const todays = wd ? db.routine.filter((r) => r.day === wd) : [];
  const running = todays.filter((r) => r.start <= now && now < r.end);
  const rooms = new Set(db.routine.map((r) => r.room)).size;
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Classes today" value={wd ? todays.length : "Friday"} sub={wd ? undefined : "weekly holiday"} icon="calendar" />
      <StatCard label="Running now" value={running.length} sub={now} icon="clock" />
      <StatCard label="Classes a week" value={db.routine.length} icon="book" />
      <StatCard label="Rooms in use" value={rooms} icon="building" />
    </div>
  );
}

// ── Routine ──────────────────────────────────────────────────────────────

function Routine({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const ongoing = db.sections.filter((s) => lookup(db.semesters, s.semesterId)?.status !== "COMPLETED");
  const [view, setView] = useState<"section" | "teacher">("section");
  const [sectionId, setSectionId] = useState(ongoing[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(db.teachers[0]?.id ?? "");
  const [adding, setAdding] = useState<{ day: Weekday; start: string; end: string } | null>(null);
  const manage = can("routines.manage") && view === "section";
  const section = lookup(db.sections, sectionId);

  const slots = db.routine.filter((r) => (view === "section" ? r.sectionId === sectionId : r.teacherId === teacherId));
  const title = view === "section" ? `${section?.name ?? ""} · ${lookup(db.semesters, section?.semesterId)?.name ?? ""}` : (lookup(db.teachers, teacherId)?.name ?? "");

  return (
    <Card>
      <Toolbar>
        <div className="flex rounded-lg border border-border-strong p-0.5 text-sm">
          {(["section", "teacher"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cx("rounded-md px-3 py-1", view === v ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text")}>
              By {v}
            </button>
          ))}
        </div>
        {view === "section" ? (
          <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
            {ongoing.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FilterSelect>
        ) : (
          <FilterSelect label="Teacher" value={teacherId} onChange={setTeacherId}>
            {db.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </FilterSelect>
        )}
        <span className="ml-auto text-xs text-muted">{slots.length} classes a week · Friday off</span>
        <PrintButton />
      </Toolbar>
      <div className="print-area overflow-x-auto p-5">
        <p className="mb-3 hidden text-lg font-semibold print:block">Class routine · {title}</p>
        <table className="w-full min-w-[760px] border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th className="w-24" />
              {PERIODS.map((p) => (
                <th key={p.start} className="px-2 py-1 text-left text-[11px] font-semibold tracking-wider text-subtle uppercase">
                  {p.start} – {p.end}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((d) => (
              <tr key={d.key}>
                <th className="pr-2 text-left align-top text-xs font-semibold text-muted">{d.label}</th>
                {PERIODS.map((p) => {
                  const here = slots.filter((s) => s.day === d.key && s.start < p.end && p.start < s.end);
                  return (
                    <td key={p.start} className="h-20 align-top">
                      {here.length ? (
                        here.map((s) => <SlotCard key={s.id} db={db} slot={s} showSection={view === "teacher"} onDelete={manage ? () => {
                          update((x) => {
                            x.routine = x.routine.filter((r) => r.id !== s.id);
                          });
                          toast("Class removed from the routine");
                        } : undefined} />)
                      ) : manage ? (
                        <button
                          onClick={() => setAdding({ day: d.key, start: p.start, end: p.end })}
                          className="no-print grid h-full min-h-20 w-full place-items-center rounded-xl border border-dashed border-border text-subtle transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
                          aria-label={`Add class on ${d.label} at ${p.start}`}
                        >
                          <Icon name="plus" className="size-4" />
                        </button>
                      ) : (
                        <div className="h-full min-h-20 rounded-xl bg-surface-2/40" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!adding} onClose={() => setAdding(null)} title={`Add class · ${section?.name ?? ""}`} description="Checked against the section, the teacher and the room.">
        {adding && section && <SlotForm db={db} section={section} initial={adding} onDone={() => setAdding(null)} />}
      </Modal>
    </Card>
  );
}

function SlotCard({ db, slot, showSection, onDelete }: { db: DemoDb; slot: RoutineSlot; showSection: boolean; onDelete?: () => void }) {
  const course = lookup(db.courses, slot.courseId);
  const lab = course?.type === "LAB";
  return (
    <div className={cx("group relative mb-1 rounded-xl border px-3 py-2", lab ? "border-warning/30 bg-warning/8" : "border-accent/25 bg-accent-soft")}>
      <p className={cx("font-mono text-xs font-semibold", lab ? "text-warning" : "text-accent")}>{course?.code}</p>
      <p className="truncate text-xs font-medium">{course?.title}</p>
      <p className="truncate text-[11px] text-muted">
        {showSection ? lookup(db.sections, slot.sectionId)?.name : (lookup(db.teachers, slot.teacherId)?.name ?? "No teacher")} · {slot.room}
      </p>
      {!PERIODS.some((p) => p.start === slot.start && p.end === slot.end) && (
        <p className="text-[11px] text-muted">
          {slot.start}–{slot.end}
        </p>
      )}
      {onDelete && (
        <button onClick={onDelete} className="no-print absolute top-1.5 right-1.5 hidden rounded-md p-1 text-subtle group-hover:block hover:bg-surface hover:text-danger" aria-label="Remove class">
          <Icon name="trash" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SlotForm({ db, section, initial, onDone }: { db: DemoDb; section: Section; initial: { day: Weekday; start: string; end: string }; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState(section.courses[0]?.courseId ?? "");
  const assigned = section.courses.find((c) => c.courseId === courseId);
  const course = lookup(db.courses, courseId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    if (!courseId) return setError("This section has no courses yet. Add them under Sections.");
    const slot = { sectionId: section.id, courseId, teacherId: f.teacherId || null, day: f.day as Weekday, start: f.start!, end: f.end!, room: f.room! };
    if (!slot.room) return setError("Enter a room.");
    const clash = routineClash(db, slot);
    if (clash) return setError(clash);
    update((d) => {
      d.routine.push({ id: newId(), ...slot });
    });
    toast(`${course?.code} added on ${WEEKDAYS.find((w) => w.key === slot.day)?.label}`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Course" className="sm:col-span-2">
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {section.courses.map((c) => {
            const x = lookup(db.courses, c.courseId)!;
            return (
              <option key={c.courseId} value={c.courseId}>
                {x.code} · {x.title}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field label="Teacher">
        <Select key={courseId} name="teacherId" defaultValue={assigned?.teacherId ?? ""}>
          <option value="">No teacher</option>
          {db.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Room">
        <Input key={courseId} name="room" defaultValue={course?.type === "LAB" ? `${lookup(db.departments, course.departmentId)?.code}-Lab-1` : section.room} />
      </Field>
      <Field label="Day">
        <Select name="day" defaultValue={initial.day}>
          {WEEKDAYS.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <Input name="start" type="time" defaultValue={initial.start} required />
        </Field>
        <Field label="Ends">
          <Input name="end" type="time" defaultValue={initial.end} required />
        </Field>
      </div>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add to routine</Button>
      </FormActions>
    </form>
  );
}
