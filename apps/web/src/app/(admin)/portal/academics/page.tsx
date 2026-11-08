"use client";

import { lookup, PERIODS, WEEKDAYS } from "@/lib/demo/logic";
import type { DemoDb, Student } from "@/lib/demo/types";
import { PortalPage } from "@/components/portal";
import { Badge, Card, cx, Table, Td, Tr } from "@/components/ui";

export default function PortalAcademics() {
  return (
    <PortalPage title="Courses & routine" description="Courses you're registered for this semester and your weekly class routine.">
      {({ db, student }) => <Academics db={db} student={student} />}
    </PortalPage>
  );
}

function Academics({ db, student }: { db: DemoDb; student: Student }) {
  const section = lookup(db.sections, student.sectionId);
  if (!section) return <Card><p className="p-5 text-sm text-muted">You aren&apos;t assigned to a section yet. Contact your department office.</p></Card>;
  const slots = db.routine.filter((r) => r.sectionId === section.id);
  const credits = section.courses.reduce((s, c) => s + (lookup(db.courses, c.courseId)?.credits ?? 0), 0);
  return (
    <div className="space-y-6">
      <Card title={`My courses · ${lookup(db.semesters, section.semesterId)?.name}`} description={`${section.name} · ${section.courses.length} courses · ${credits} credits · home room ${section.room}`}>
        <Table head={["Course", "Credits", "Type", "Teacher", "Classes a week"]}>
          {section.courses.map((c) => {
            const course = lookup(db.courses, c.courseId)!;
            const teacher = lookup(db.teachers, c.teacherId);
            return (
              <Tr key={c.courseId}>
                <Td>
                  <span className="font-mono text-xs text-muted">{course.code}</span> <span className="font-medium">{course.title}</span>
                </Td>
                <Td className="tabular-nums">{course.credits}</Td>
                <Td>{course.type === "LAB" ? <Badge tone="warning">Lab</Badge> : <Badge>Theory</Badge>}</Td>
                <Td>
                  {teacher ? (
                    <>
                      <p>{teacher.name}</p>
                      <p className="text-xs text-muted">{teacher.email}</p>
                    </>
                  ) : (
                    <span className="text-subtle">Not assigned</span>
                  )}
                </Td>
                <Td className="tabular-nums">{slots.filter((s) => s.courseId === c.courseId).length}</Td>
              </Tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Weekly routine" description="Saturday to Thursday · Friday off">
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[720px] border-separate border-spacing-1.5 text-sm">
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
                      <td key={p.start} className="h-16 align-top">
                        {here.map((s) => {
                          const course = lookup(db.courses, s.courseId);
                          const lab = course?.type === "LAB";
                          return (
                            <div key={s.id} className={cx("rounded-xl border px-3 py-2", lab ? "border-warning/30 bg-warning/8" : "border-accent/25 bg-accent-soft")}>
                              <p className={cx("font-mono text-xs font-semibold", lab ? "text-warning" : "text-accent")}>{course?.code}</p>
                              <p className="truncate text-[11px] text-muted">
                                {s.room} · {lookup(db.teachers, s.teacherId)?.name ?? "—"}
                              </p>
                            </div>
                          );
                        })}
                        {!here.length && <div className="h-full min-h-16 rounded-xl bg-surface-2/40" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
