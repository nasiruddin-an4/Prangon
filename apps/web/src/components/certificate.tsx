import { formatGpa, lookup, semesterResult } from "@/lib/demo/logic";
import type { CertificateType, DemoDb, Student } from "@/lib/demo/types";
import { formatDate } from "./ui";

/** Who may receive each certificate. */
export const CERT: Record<CertificateType, { label: string; who: string; allowed: (s: Student) => boolean }> = {
  STUDENTSHIP: { label: "Studentship certificate", who: "Current (active) students", allowed: (s) => s.status === "ACTIVE" },
  CHARACTER: { label: "Character certificate", who: "Any student not dropped out", allowed: (s) => s.status !== "DROPPED" },
  TESTIMONIAL: { label: "Testimonial", who: "Graduated students only", allowed: (s) => s.status === "GRADUATED" },
};

/** Certificate text, laid out to print on letterhead. */
export function Certificate({ db, institution, type, student, purpose, serial, date }: { db: DemoDb; institution: string; type: CertificateType; student: Student; purpose: string | null; serial: string; date: string }) {
  const program = lookup(db.programs, student.programId);
  const guardian = lookup(db.guardians, student.guardianIds[0]);
  const he = student.gender === "FEMALE" ? "She" : "He";
  const his = student.gender === "FEMALE" ? "her" : "his";
  const result = student.sectionId ? semesterResult(db, student.sectionId, student.id) : null;
  const body: Record<CertificateType, string> = {
    STUDENTSHIP: `This is to certify that ${student.name}, ${guardian && (guardian.relation === "Father" || guardian.relation === "Mother") ? `${student.gender === "FEMALE" ? "daughter" : "son"} of ${guardian.name}, ` : ""}Student ID ${student.studentId}, is a regular student of the ${program?.name} programme (Batch ${student.batch}) at ${institution}. ${he} was admitted on ${formatDate(student.admissionDate)} and is currently enrolled.`,
    CHARACTER: `This is to certify that ${student.name}, Student ID ${student.studentId}, ${student.status === "GRADUATED" ? "was" : "is"} a student of the ${program?.name} programme at ${institution}. To the best of my knowledge, ${his} conduct and character have been good, and ${he.toLowerCase()} has not been involved in any activity subversive of the state or of discipline.`,
    TESTIMONIAL: `This is to certify that ${student.name}, Student ID ${student.studentId}, has completed the ${program?.name} programme at ${institution}${result?.complete ? ` with a latest semester GPA of ${formatGpa(result.gpa)}` : ""}. ${he} bears a good moral character. I wish ${his} every success in life.`,
  };
  return (
    <div className="print-area space-y-6 p-8 font-serif">
      <div className="text-center">
        <p className="text-lg font-semibold">{institution}</p>
        <p className="mt-4 text-xl font-semibold tracking-wide underline underline-offset-4">{CERT[type].label}</p>
      </div>
      <div className="flex justify-between text-sm">
        <span>Ref: {serial}</span>
        <span>Date: {formatDate(date)}</span>
      </div>
      <p className="text-[15px] leading-relaxed">{body[type]}</p>
      {purpose && <p className="text-sm">This certificate is issued on request for the purpose of: {purpose}.</p>}
      <div className="flex justify-end pt-12">
        <div className="text-center text-sm">
          <div className="mb-1 w-48 border-t border-text" />
          Registrar
        </div>
      </div>
    </div>
  );
}
