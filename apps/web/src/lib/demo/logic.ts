/**
 * Business rules for the browser-storage modules. Kept free of React and
 * storage so the same functions can move to the API services unchanged.
 */
import type { AttendanceSheet, BookIssue, DemoDb, Invoice, LeaveType, Mark, Payment, PaymentMethod, PersonRef, RoutineSlot, Salary, Weekday } from "./types";

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** Today's date in Bangladesh (YYYY-MM-DD). Call only in the browser. */
export const todayDhaka = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

export const nowIso = () => new Date().toISOString();

/** ৳1,25,000 — BDT with South Asian digit grouping. */
export const taka = (amount: number) => `৳${Math.round(amount).toLocaleString("en-IN")}`;

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "SAT", label: "Saturday" },
  { key: "SUN", label: "Sunday" },
  { key: "MON", label: "Monday" },
  { key: "TUE", label: "Tuesday" },
  { key: "WED", label: "Wednesday" },
  { key: "THU", label: "Thursday" },
];

export const DIVISIONS = ["Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const BOARDS = ["Dhaka", "Chattogram", "Rajshahi", "Cumilla", "Jashore", "Sylhet", "Barishal", "Dinajpur", "Mymensingh", "Madrasah", "Technical"];

export const PAYMENT_METHODS: { key: PaymentMethod; label: string; needsTxn: boolean }[] = [
  { key: "CASH", label: "Cash", needsTxn: false },
  { key: "BKASH", label: "bKash", needsTxn: true },
  { key: "NAGAD", label: "Nagad", needsTxn: true },
  { key: "ROCKET", label: "Rocket", needsTxn: true },
  { key: "SSLCOMMERZ", label: "SSLCommerz (card)", needsTxn: true },
  { key: "BANK", label: "Bank deposit", needsTxn: true },
];
export const methodLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((p) => p.key === m)?.label ?? m;

/** Next value of a named counter, e.g. receipts or student serials. Mutates `db`. */
export function nextCounter(db: DemoDb, key: string) {
  db.counters[key] = (db.counters[key] ?? 0) + 1;
  return db.counters[key]!;
}

// ── Student IDs ──────────────────────────────────────────────────────────

/**
 * Builds a student ID from the institution's format, e.g. `{YY}{DEPT}{SEQ:4}`
 * → `26CSE0007`. The sequence is per year + department, so IDs stay short.
 */
export function generateStudentId(db: DemoDb, format: string, opts: { year: number; dept: string; campus: string | null }) {
  const yy = String(opts.year).slice(-2);
  const key = `student:${opts.year}:${opts.dept}`;
  let id: string;
  do {
    const seq = nextCounter(db, key);
    id = format
      .replace("{YYYY}", String(opts.year))
      .replace("{YY}", yy)
      .replace("{CAMPUS}", (opts.campus ?? "MAIN").toUpperCase())
      .replace("{DEPT}", opts.dept.toUpperCase())
      .replace(/\{SEQ:(\d)\}/, (_, n: string) => String(seq).padStart(Number(n), "0"));
  } while (db.students.some((s) => s.studentId === id));
  return id;
}

// ── Grading (UGC uniform grading system) ─────────────────────────────────

export const MARK_PARTS = [
  { key: "attendance", label: "Attendance", max: 10 },
  { key: "classTest", label: "Class test", max: 20 },
  { key: "midterm", label: "Midterm", max: 30 },
  { key: "final", label: "Final", max: 40 },
] as const;

const SCALE: [min: number, letter: string, point: number][] = [
  [80, "A+", 4.0],
  [75, "A", 3.75],
  [70, "A-", 3.5],
  [65, "B+", 3.25],
  [60, "B", 3.0],
  [55, "B-", 2.75],
  [50, "C+", 2.5],
  [45, "C", 2.25],
  [40, "D", 2.0],
  [0, "F", 0],
];
export const GRADE_SCALE = SCALE;

export function grade(total: number) {
  const row = SCALE.find(([min]) => total >= min)!;
  return { letter: row[1], point: row[2] };
}

export const markTotal = (m: Pick<Mark, "attendance" | "classTest" | "midterm" | "final">) =>
  (m.attendance ?? 0) + (m.classTest ?? 0) + (m.midterm ?? 0) + (m.final ?? 0);

export const markComplete = (m: Mark | undefined): m is Mark =>
  !!m && m.attendance !== null && m.classTest !== null && m.midterm !== null && m.final !== null;

/** Credit-weighted GPA over the courses with complete marks. */
export function semesterResult(db: DemoDb, sectionId: string, studentId: string) {
  const section = db.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  const rows = section.courses.map(({ courseId }) => {
    const course = db.courses.find((c) => c.id === courseId)!;
    const mark = db.marks.find((m) => m.sectionId === sectionId && m.courseId === courseId && m.studentId === studentId);
    const complete = markComplete(mark);
    const total = mark ? markTotal(mark) : 0;
    return { course, mark, complete, total, ...grade(total) };
  });
  const done = rows.filter((r) => r.complete);
  const credits = done.reduce((s, r) => s + r.course.credits, 0);
  const gpa = credits ? done.reduce((s, r) => s + r.point * r.course.credits, 0) / credits : null;
  const failed = done.some((r) => r.letter === "F");
  return { rows, gpa, credits, complete: done.length === rows.length && rows.length > 0, failed };
}

// ── Attendance ───────────────────────────────────────────────────────────

export function attendanceStats(sheets: AttendanceSheet[], studentId: string) {
  let present = 0;
  let late = 0;
  let total = 0;
  for (const sheet of sheets) {
    const mark = sheet.marks[studentId];
    if (!mark) continue;
    total++;
    if (mark === "P") present++;
    if (mark === "L") late++;
  }
  // Late counts as attended.
  const percent = total ? Math.round(((present + late) / total) * 100) : null;
  return { present, late, absent: total - present - late, total, percent };
}

/** Universities commonly require 75% attendance to sit the final exam. */
export const MIN_ATTENDANCE = 75;

// ── Fees ─────────────────────────────────────────────────────────────────

export function invoiceTotals(invoice: Invoice, payments: Payment[]) {
  const gross = invoice.items.reduce((s, i) => s + i.amount, 0);
  const net = Math.max(0, gross - invoice.discount);
  const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, net - paid);
  return { gross, net, paid, due };
}

export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE";

export function invoiceStatus(invoice: Invoice, payments: Payment[], today: string): InvoiceStatus {
  const { paid, due } = invoiceTotals(invoice, payments);
  if (due === 0) return "PAID";
  if (invoice.dueDate < today) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "UNPAID";
}

// ── Routine ──────────────────────────────────────────────────────────────

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};

/**
 * Why a slot can't be scheduled: the section, the teacher or the room is
 * already busy at an overlapping time that day. Returns null when it fits.
 */
export function routineClash(db: DemoDb, slot: Omit<RoutineSlot, "id"> & { id?: string }) {
  if (minutes(slot.end) <= minutes(slot.start)) return "The class must end after it starts.";
  const semesterId = db.sections.find((s) => s.id === slot.sectionId)?.semesterId;
  const overlapping = db.routine.filter(
    (r) =>
      r.id !== slot.id &&
      r.day === slot.day &&
      minutes(r.start) < minutes(slot.end) &&
      minutes(slot.start) < minutes(r.end) &&
      db.sections.find((s) => s.id === r.sectionId)?.semesterId === semesterId,
  );
  const name = (sectionId: string) => db.sections.find((s) => s.id === sectionId)?.name ?? "another section";
  const section = overlapping.find((r) => r.sectionId === slot.sectionId);
  if (section) return `${name(slot.sectionId)} already has a class from ${section.start} to ${section.end}.`;
  const teacher = slot.teacherId ? overlapping.find((r) => r.teacherId === slot.teacherId) : undefined;
  if (teacher) {
    const t = db.teachers.find((x) => x.id === slot.teacherId)?.name ?? "This teacher";
    return `${t} is teaching ${name(teacher.sectionId)} from ${teacher.start} to ${teacher.end}.`;
  }
  const room = overlapping.find((r) => r.room.trim().toLowerCase() === slot.room.trim().toLowerCase());
  if (room) return `Room ${slot.room} is used by ${name(room.sectionId)} from ${room.start} to ${room.end}.`;
  return null;
}

export const PERIODS = [
  { start: "09:00", end: "10:30" },
  { start: "10:45", end: "12:15" },
  { start: "13:00", end: "14:30" },
  { start: "14:45", end: "16:15" },
];

// ── Display helpers ──────────────────────────────────────────────────────

export const lookup = <T extends { id: string }>(list: T[], id: string | null | undefined) => (id ? list.find((x) => x.id === id) : undefined);

export function ageFrom(dateOfBirth: string, today: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty! - y! - (tm! < m! || (tm === m && td! < d!) ? 1 : 0);
}

// ── Validation & export ──────────────────────────────────────────────────

/** Bangladeshi mobile number: 01XXXXXXXXX, optionally with +88. */
export const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;
export const normalizePhone = (value: string) => value.replace(/[\s-]/g, "").replace(/^\+?88/, "");

/** Downloads rows as a CSV file Excel opens correctly (UTF-8 with BOM). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal CSV parser (quoted fields, commas, CRLF). */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export const formatGpa = (gpa: number | null | undefined) => (gpa === null || gpa === undefined ? "—" : gpa.toFixed(2));


// ── People ───────────────────────────────────────────────────────────────

/** Name and a short descriptor for a student, teacher or staff member. */
export function person(db: DemoDb, ref: PersonRef) {
  if (ref.type === "STUDENT") {
    const s = lookup(db.students, ref.id);
    return { name: s?.name ?? "Unknown student", detail: s ? `${s.studentId} · ${lookup(db.sections, s.sectionId)?.name ?? "No section"}` : "", kind: "Student" };
  }
  if (ref.type === "TEACHER") {
    const t = lookup(db.teachers, ref.id);
    return { name: t?.name ?? "Unknown teacher", detail: t ? `${t.designation} · ${lookup(db.departments, t.departmentId)?.code ?? ""}` : "", kind: "Teacher" };
  }
  const s = lookup(db.staff, ref.id);
  return { name: s?.name ?? "Unknown staff", detail: s ? `${s.designation} · ${s.office}` : "", kind: "Staff" };
}

export const sameRef = (a: PersonRef, b: PersonRef) => a.type === b.type && a.id === b.id;

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// ── Leave ────────────────────────────────────────────────────────────────

/** Working days in a date range, inclusive; Friday is the weekly holiday. */
export function workingDays(from: string, to: string) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 5) n++;
  return n;
}

/** Yearly entitlement for teachers and staff (days). Students have no quota. */
export const LEAVE_QUOTA: Partial<Record<LeaveType, number>> = { CASUAL: 10, SICK: 14, EARNED: 20, MATERNITY: 112 };
export const LEAVE_LABEL: Record<LeaveType, string> = { CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", MATERNITY: "Maternity", OTHER: "Other" };

export function leaveUsed(db: DemoDb, ref: PersonRef, type: LeaveType, year: string, excludeId?: string) {
  return db.leaves
    .filter((l) => l.id !== excludeId && l.status === "APPROVED" && l.type === type && sameRef(l.person, ref) && l.from.startsWith(year))
    .reduce((s, l) => s + l.days, 0);
}

/** Who is on approved leave on a given day. */
export const onLeave = (db: DemoDb, ref: PersonRef, date: string) => db.leaves.some((l) => l.status === "APPROVED" && sameRef(l.person, ref) && l.from <= date && date <= l.to);

// ── Library ──────────────────────────────────────────────────────────────

export const LOAN_DAYS = 14;
export const FINE_PER_DAY = 5;
export const BORROW_LIMIT: Record<PersonRef["type"], number> = { STUDENT: 3, TEACHER: 6, STAFF: 3 };

export const copiesOut = (db: DemoDb, bookId: string) => db.bookIssues.filter((i) => i.bookId === bookId && !i.returnedOn).length;

/** Late fine so far (open loan) or as charged (returned). */
export const fineFor = (issue: BookIssue, today: string) =>
  issue.returnedOn ? issue.fine : Math.max(0, daysBetween(issue.dueOn, today)) * FINE_PER_DAY;

/** Why a book can't be issued to this borrower, or null. */
export function issueProblem(db: DemoDb, bookId: string, borrower: PersonRef, today: string) {
  const book = lookup(db.books, bookId);
  if (!book) return "Choose a book.";
  if (copiesOut(db, bookId) >= book.copies) return `All ${book.copies} copies of “${book.title}” are out.`;
  const open = db.bookIssues.filter((i) => !i.returnedOn && sameRef(i.borrower, borrower));
  if (open.some((i) => i.bookId === bookId)) return "This borrower already has a copy of this book.";
  if (open.some((i) => i.dueOn < today)) return "This borrower has an overdue book. It must be returned first.";
  if (open.length >= BORROW_LIMIT[borrower.type]) return `The limit is ${BORROW_LIMIT[borrower.type]} books at a time for ${borrower.type.toLowerCase()}s.`;
  return null;
}

// ── Payroll ──────────────────────────────────────────────────────────────

/**
 * Bangladesh personal income tax slabs (annual, general taxpayer), applied to
 * 12 × gross. A simplified estimate for payroll TDS: it ignores exemptions,
 * investment rebate and the minimum tax.
 */
const TAX_SLABS: [width: number, rate: number][] = [
  [350000, 0],
  [100000, 0.05],
  [400000, 0.1],
  [500000, 0.15],
  [500000, 0.2],
  [Infinity, 0.25],
];

export function monthlyTax(gross: number) {
  let remaining = gross * 12;
  let tax = 0;
  for (const [width, rate] of TAX_SLABS) {
    const part = Math.min(remaining, width);
    tax += part * rate;
    remaining -= part;
    if (remaining <= 0) break;
  }
  return Math.round(tax / 12);
}

/** Provident fund: 10% of basic, deducted from salary. */
export const PF_RATE = 0.1;

export function payslip(s: Salary) {
  const gross = s.basic + s.houseRent + s.medical + s.conveyance;
  const providentFund = Math.round(s.basic * PF_RATE);
  const tax = monthlyTax(gross);
  return { gross, providentFund, tax, net: gross - providentFund - tax };
}

export const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

// ── Transport & hostel ───────────────────────────────────────────────────

export const routeLoad = (db: DemoDb, routeId: string) => db.transport.filter((t) => t.routeId === routeId).length;
export const roomLoad = (db: DemoDb, roomId: string) => db.allocations.filter((a) => a.roomId === roomId && !a.to).length;
export const activeAllocation = (db: DemoDb, studentId: string) => db.allocations.find((a) => a.studentId === studentId && !a.to);
