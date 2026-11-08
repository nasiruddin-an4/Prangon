import { lookup } from "@/lib/demo/logic";
import type { DemoDb, Exam, Student } from "@/lib/demo/types";
import { formatDate } from "./ui";

/** Printable admit card: issued only to eligible students (attendance + fees). */
export function AdmitCard({ db, institution, exam, student }: { db: DemoDb; institution: string; exam: Exam; student: Student }) {
  const section = lookup(db.sections, student.sectionId);
  const program = lookup(db.programs, student.programId);
  return (
    <div className="break-inside-avoid rounded-xl border border-border bg-surface p-5 text-sm">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-dashed border-border pb-3">
        <div>
          <p className="font-semibold">{institution}</p>
          <p className="text-xs tracking-wider text-muted uppercase">Admit card · {exam.name}</p>
        </div>
        <div className="text-right text-xs text-muted">
          {lookup(db.semesters, exam.semesterId)?.name}
          <br />
          {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md border border-dashed border-border-strong bg-surface-2 text-xs text-subtle">Photo</div>
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-xs text-subtle">Name</dt>
          <dd className="font-medium">{student.name}</dd>
          <dt className="text-xs text-subtle">Student ID</dt>
          <dd className="font-mono">{student.studentId}</dd>
          <dt className="text-xs text-subtle">Program</dt>
          <dd className="truncate">{program?.code}</dd>
          <dt className="text-xs text-subtle">Section</dt>
          <dd>{section?.name}</dd>
        </dl>
      </div>
      <p className="mt-3 text-xs text-muted">
        Courses: {section?.courses.map((c) => lookup(db.courses, c.courseId)?.code).join(", ")}
      </p>
      <div className="mt-6 flex justify-between text-[11px] text-muted">
        <span className="border-t border-border-strong pt-1">Student&apos;s signature</span>
        <span className="border-t border-border-strong pt-1">Controller of Examinations</span>
      </div>
    </div>
  );
}
