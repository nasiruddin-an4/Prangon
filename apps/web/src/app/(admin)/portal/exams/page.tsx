"use client";

import { useAuth } from "@/lib/auth";
import { formatGpa, lookup, semesterResult, todayDhaka } from "@/lib/demo/logic";
import type { DemoDb, Student } from "@/lib/demo/types";
import { examEligibility } from "@/lib/demo/workflows";
import { AdmitCard } from "@/components/admit-card";
import { PrintButton } from "@/components/demo";
import { PortalPage } from "@/components/portal";
import { Badge, Card, formatDate, Table, Td, Tr } from "@/components/ui";

export default function PortalExams() {
  return (
    <PortalPage title="Exams & results" description="Exam schedule, your admit card, and results once the Controller of Examinations publishes them.">
      {({ db, student }) => <Exams db={db} student={student} />}
    </PortalPage>
  );
}

function Exams({ db, student }: { db: DemoDb; student: Student }) {
  const { tenant } = useAuth();
  const today = todayDhaka();
  const section = lookup(db.sections, student.sectionId);
  const exams = db.exams.filter((e) => e.semesterId === section?.semesterId).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = exams.find((e) => e.endDate >= today);
  const elig = examEligibility(db, student, today);
  const published = !!section && db.publications.some((p) => p.sectionId === section.id);
  const result = section ? semesterResult(db, section.id, student.id) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card title="Exam schedule" description={section ? lookup(db.semesters, section.semesterId)?.name : undefined}>
          <Table head={["Exam", "Dates", "Status"]}>
            {exams.map((e) => {
              const status = e.endDate < today ? "Done" : e.startDate <= today ? "Ongoing" : "Upcoming";
              return (
                <Tr key={e.id}>
                  <Td className="font-medium">{e.name}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDate(e.startDate)} – {formatDate(e.endDate)}
                  </Td>
                  <Td>
                    <Badge tone={status === "Done" ? "neutral" : status === "Ongoing" ? "success" : "accent"} dot>
                      {status}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </Table>
        </Card>
        <Card title="Admit card" description={next ? next.name : "No upcoming exam"} actions={elig.eligible && next ? <PrintButton label="Print" /> : undefined}>
          <div className="p-5">
            {!next ? (
              <p className="text-sm text-muted">Your admit card appears here before the next exam.</p>
            ) : elig.eligible ? (
              <div className="print-area">
                <AdmitCard db={db} institution={tenant?.name ?? ""} exam={next} student={student} />
              </div>
            ) : (
              <div className="rounded-xl bg-danger/8 p-4 text-sm text-danger">
                <p className="font-medium">You aren&apos;t eligible for an admit card yet</p>
                <ul className="mt-1 list-disc pl-5">
                  {elig.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Clear your dues at Accounts or speak to your department about attendance.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Results" description={published ? "Published by the Controller of Examinations" : "Grades appear after publication. Marks entered so far are shown below."}>
        {result && (
          <>
            {published && result.complete && (
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-sm text-muted">Semester GPA</span>
                <span className="text-2xl font-semibold tabular-nums">{formatGpa(result.gpa)}</span>
              </div>
            )}
            <Table head={published ? ["Course", "Credits", "Total", "Grade", "Point"] : ["Course", "Attendance /10", "Class test /20", "Midterm /30"]}>
              {result.rows.map((r) => (
                <Tr key={r.course.id}>
                  <Td>
                    <span className="font-mono text-xs text-muted">{r.course.code}</span> {r.course.title}
                  </Td>
                  {published ? (
                    <>
                      <Td className="tabular-nums">{r.course.credits}</Td>
                      <Td className="tabular-nums">{r.mark ? r.total : "—"}</Td>
                      <Td>{r.complete ? <Badge tone={r.letter === "F" ? "danger" : "accent"}>{r.letter}</Badge> : "—"}</Td>
                      <Td className="tabular-nums">{r.complete ? r.point.toFixed(2) : "—"}</Td>
                    </>
                  ) : (
                    <>
                      <Td className="tabular-nums">{r.mark?.attendance ?? "—"}</Td>
                      <Td className="tabular-nums">{r.mark?.classTest ?? "—"}</Td>
                      <Td className="tabular-nums">{r.mark?.midterm ?? "—"}</Td>
                    </>
                  )}
                </Tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
