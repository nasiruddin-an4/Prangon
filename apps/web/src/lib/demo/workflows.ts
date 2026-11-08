/**
 * Rules for work that crosses offices. One office never edits another's
 * records directly: it raises a request or a charge, and the owning office
 * acts on it. These functions mirror the planned workflow API.
 */
import { attendanceStats, addDays, invoiceStatus, invoiceTotals, lookup, MIN_ATTENDANCE, nextCounter, nowIso, semesterResult } from "./logic";
import type { CertificateRequest, ClearanceOffice, DemoDb, Invoice, Notice, Student } from "./types";

export const CERTIFICATE_FEE = 300;

/**
 * Raises a charge on a student's account (library fine, certificate fee).
 * Accounts sees it with the semester invoices and collects it the same way.
 */
export function raiseCharge(d: DemoDb, studentId: string, kind: NonNullable<Invoice["kind"]>, label: string, amount: number, today: string, dueInDays = 14): Invoice {
  const semesterId = d.semesters.find((s) => s.status === "ONGOING")?.id ?? d.semesters[0]!.id;
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    kind,
    invoiceNo: `${kind === "FINE" ? "FIN" : "CRT"}-${today.slice(0, 4)}-${String(nextCounter(d, `charge:${kind}`)).padStart(5, "0")}`,
    studentId,
    semesterId,
    items: [{ label, amount }],
    discount: 0,
    discountLabel: null,
    dueDate: addDays(today, dueInDays),
    issuedAt: nowIso(),
  };
  d.invoices.push(invoice);
  return invoice;
}

export const isPaid = (db: DemoDb, invoiceId: string | null | undefined) => {
  const inv = lookup(db.invoices, invoiceId);
  return !!inv && invoiceTotals(inv, db.payments).due === 0;
};

/** Total a student still owes across every invoice and charge. */
export const studentDue = (db: DemoDb, studentId: string) =>
  db.invoices.filter((i) => i.studentId === studentId).reduce((s, i) => s + invoiceTotals(i, db.payments).due, 0);

// ── Certificates ─────────────────────────────────────────────────────────

export type CertificateStage = "SUBMITTED" | "AWAITING_FEE" | "READY" | "ISSUED" | "REJECTED";

/** Where a request is: a paid fee moves it from Accounts to the Document office. */
export function certificateStage(db: DemoDb, r: CertificateRequest): CertificateStage {
  if (r.status === "AWAITING_FEE" && isPaid(db, r.invoiceId)) return "READY";
  return r.status;
}

export const STAGE_LABEL: Record<CertificateStage, string> = {
  SUBMITTED: "Registrar verification",
  AWAITING_FEE: "Fee due at Accounts",
  READY: "Ready to issue",
  ISSUED: "Issued",
  REJECTED: "Rejected",
};

// ── Exam eligibility ─────────────────────────────────────────────────────

/** Sits the exam only with 75% attendance and no overdue fees. */
export function examEligibility(db: DemoDb, student: Student, today: string) {
  const reasons: string[] = [];
  if (student.status !== "ACTIVE") reasons.push(`Student is ${student.status.toLowerCase()}`);
  const pct = attendanceStats(db.attendance.filter((a) => a.sectionId === student.sectionId), student.id).percent;
  if (pct !== null && pct < MIN_ATTENDANCE) reasons.push(`Attendance ${pct}% (needs ${MIN_ATTENDANCE}%)`);
  const overdue = db.invoices.filter((i) => i.studentId === student.id && invoiceStatus(i, db.payments, today) === "OVERDUE");
  if (overdue.length) reasons.push(`Overdue fees: ${overdue.map((i) => i.invoiceNo).join(", ")}`);
  return { eligible: reasons.length === 0, reasons, attendance: pct };
}

// ── Clearance ────────────────────────────────────────────────────────────

export const CLEARANCE_OFFICES: { key: ClearanceOffice; label: string; permission: "finance.collect" | "library.manage" | "students.manage" | "academics.manage" }[] = [
  { key: "ACCOUNTS", label: "Accounts", permission: "finance.collect" },
  { key: "LIBRARY", label: "Library", permission: "library.manage" },
  { key: "HOSTEL", label: "Hostel", permission: "students.manage" },
  { key: "TRANSPORT", label: "Transport", permission: "students.manage" },
  { key: "DEPARTMENT", label: "Department", permission: "academics.manage" },
];

/** What each office checks before it can sign a student off. */
export function clearanceChecks(db: DemoDb, studentId: string): Record<ClearanceOffice, { ok: boolean; detail: string }> {
  const due = studentDue(db, studentId);
  const loans = db.bookIssues.filter((i) => !i.returnedOn && i.borrower.type === "STUDENT" && i.borrower.id === studentId).length;
  const bed = db.allocations.find((a) => a.studentId === studentId && !a.to);
  const bus = db.transport.find((t) => t.studentId === studentId);
  const student = lookup(db.students, studentId);
  const result = student?.sectionId ? semesterResult(db, student.sectionId, studentId) : null;
  return {
    ACCOUNTS: { ok: due === 0, detail: due ? `৳${due.toLocaleString("en-IN")} outstanding` : "No dues" },
    LIBRARY: { ok: loans === 0, detail: loans ? `${loans} book${loans === 1 ? "" : "s"} not returned` : "All books returned" },
    HOSTEL: { ok: !bed, detail: bed ? `Still in room ${lookup(db.rooms, bed.roomId)?.number}` : "No hostel seat" },
    TRANSPORT: { ok: !bus, detail: bus ? `Registered on ${lookup(db.routes, bus.routeId)?.code}` : "Not on a bus route" },
    DEPARTMENT: {
      ok: !result || (result.complete && !result.failed),
      detail: !result ? "No current section" : !result.complete ? "Results incomplete this semester" : result.failed ? "Has a failed course" : "Academic requirements met",
    },
  };
}

// ── Notices for one student ──────────────────────────────────────────────

export function noticesFor(db: DemoDb, student: Student, today: string): Notice[] {
  return db.notices
    .filter((n) => (n.audience === "EVERYONE" || n.audience === "STUDENTS") && (!n.sectionId || n.sectionId === student.sectionId) && (!n.expiresOn || n.expiresOn >= today))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt));
}

/** Official university email for a student, e.g. 26cse0001@student.demo-university.edu.bd. */
export const officialEmailFor = (student: Student, institutionSlug: string) => `${student.studentId.toLowerCase()}@student.${institutionSlug}.edu.bd`;
