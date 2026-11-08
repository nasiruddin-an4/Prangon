/**
 * Records for the modules that run on browser storage until their API
 * endpoints exist (Phases 2–5). The shapes mirror the planned Prisma models so
 * moving them to Postgres is a data-layer change, not a UI rewrite.
 */

export type ISODate = string; // "2026-11-08"
export type ISODateTime = string;

export interface Faculty {
  id: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  facultyId: string;
  name: string;
  code: string;
}

export interface Program {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  degree: "BACHELOR" | "MASTER" | "DIPLOMA";
  durationSemesters: number;
  totalCredits: number;
}

export interface Course {
  id: string;
  departmentId: string;
  code: string;
  title: string;
  credits: number;
  type: "THEORY" | "LAB";
}

export type SemesterStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

export interface Semester {
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  status: SemesterStatus;
}

export type Designation = "Professor" | "Associate Professor" | "Assistant Professor" | "Lecturer";

export interface Teacher {
  id: string;
  name: string;
  designation: Designation;
  departmentId: string;
  email: string;
  phone: string;
}

export interface Section {
  id: string;
  programId: string;
  semesterId: string;
  name: string;
  batch: string;
  room: string;
  /** Courses this section takes this semester, with the teacher of each. */
  courses: { courseId: string; teacherId: string | null }[];
}

export type Weekday = "SAT" | "SUN" | "MON" | "TUE" | "WED" | "THU";

export interface RoutineSlot {
  id: string;
  sectionId: string;
  courseId: string;
  teacherId: string | null;
  day: Weekday;
  start: string; // "09:00"
  end: string; // "10:30"
  room: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type StudentStatus = "ACTIVE" | "SUSPENDED" | "GRADUATED" | "DROPPED";

export interface Guardian {
  id: string;
  name: string;
  relation: "Father" | "Mother" | "Brother" | "Sister" | "Uncle" | "Other";
  phone: string;
  email: string | null;
  occupation: string | null;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  gender: Gender;
  dateOfBirth: ISODate;
  bloodGroup: string | null;
  phone: string;
  email: string | null;
  programId: string;
  sectionId: string | null;
  batch: string;
  campus: string | null;
  admissionDate: ISODate;
  status: StudentStatus;
  division: string | null;
  district: string | null;
  address: string | null;
  guardianIds: string[];
  createdAt: ISODateTime;
  /** Official university email; set when a portal login is created. */
  officialEmail?: string | null;
}

export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "ENROLLED";

export interface Application {
  id: string;
  applicationNo: string;
  name: string;
  gender: Gender;
  dateOfBirth: ISODate;
  phone: string;
  email: string | null;
  programId: string;
  sscGpa: number;
  hscGpa: number;
  hscYear: number;
  board: string;
  guardianName: string;
  guardianRelation: Guardian["relation"];
  guardianPhone: string;
  division: string | null;
  district: string | null;
  status: ApplicationStatus;
  testScore: number | null;
  notes: string | null;
  appliedAt: ISODateTime;
  decidedAt: ISODateTime | null;
  /** Set once the applicant is enrolled. */
  studentId: string | null;
}

export type AttendanceMark = "P" | "A" | "L";

export interface AttendanceSheet {
  id: string;
  sectionId: string;
  courseId: string;
  date: ISODate;
  marks: Record<string, AttendanceMark>; // student.id → mark
  takenBy: string;
  takenAt: ISODateTime;
  /** Changes after the first save, kept as an audit trail. */
  edits?: { at: ISODateTime; by: string; studentId: string; from: AttendanceMark; to: AttendanceMark; reason: string }[];
}

export type ExamType = "CLASS_TEST" | "MIDTERM" | "FINAL";

export interface Exam {
  id: string;
  semesterId: string;
  name: string;
  type: ExamType;
  startDate: ISODate;
  endDate: ISODate;
}

/** One student's marks in one course (out of 100: 10 + 20 + 30 + 40). */
export interface Mark {
  id: string;
  sectionId: string;
  courseId: string;
  studentId: string;
  attendance: number | null;
  classTest: number | null;
  midterm: number | null;
  final: number | null;
}

export interface ResultPublication {
  sectionId: string;
  publishedAt: ISODateTime;
  publishedBy: string;
}

export interface FeeItem {
  label: string;
  amount: number;
}

export interface FeeStructure {
  id: string;
  programId: string;
  name: string;
  items: FeeItem[];
}

export interface Scholarship {
  id: string;
  name: string;
  percent: number;
  studentIds: string[];
}

export interface Invoice {
  id: string;
  /** Semester fees, or a charge raised by another office (library fine, certificate fee). */
  kind?: "SEMESTER" | "FINE" | "CERTIFICATE";
  invoiceNo: string;
  studentId: string;
  semesterId: string;
  items: FeeItem[];
  discount: number;
  discountLabel: string | null;
  dueDate: ISODate;
  issuedAt: ISODateTime;
}

export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "ROCKET" | "SSLCOMMERZ" | "BANK";

export interface Payment {
  id: string;
  receiptNo: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  transactionId: string | null;
  paidAt: ISODateTime;
  collectedBy: string;
}

export type StaffStatus = "ACTIVE" | "ON_LEAVE" | "RESIGNED";

/** Non-teaching staff: registrar's office, accounts, library, IT, admin. */
export interface Staff {
  id: string;
  name: string;
  designation: string;
  office: string;
  email: string;
  phone: string;
  joinedOn: ISODate;
  status: StaffStatus;
}

export type NoticeAudience = "EVERYONE" | "STUDENTS" | "GUARDIANS" | "TEACHERS" | "STAFF";

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  /** Limits a student/guardian notice to one section; null = all. */
  sectionId: string | null;
  pinned: boolean;
  publishedAt: ISODateTime;
  expiresOn: ISODate | null;
  author: string;
}

// ── People-wide references ───────────────────────────────────────────────

export type PersonType = "STUDENT" | "TEACHER" | "STAFF";
export interface PersonRef {
  type: PersonType;
  id: string;
}

// ── Leave ────────────────────────────────────────────────────────────────

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "MATERNITY" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  person: PersonRef;
  type: LeaveType;
  from: ISODate;
  to: ISODate;
  /** Working days (Fridays excluded). */
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: ISODateTime;
  decidedAt: ISODateTime | null;
  decidedBy: string | null;
  remark: string | null;
}

// ── Library ──────────────────────────────────────────────────────────────

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  copies: number;
  shelf: string;
}

export interface BookIssue {
  id: string;
  bookId: string;
  borrower: PersonRef;
  issuedOn: ISODate;
  dueOn: ISODate;
  returnedOn: ISODate | null;
  /** Fine charged on return (৳). */
  fine: number;
  issuedBy: string;
  /** For students, the fine is billed to Accounts as an invoice instead of collected at the desk. */
  fineInvoiceId?: string | null;
}

// ── Expenses & payroll ───────────────────────────────────────────────────

export type ExpenseCategory = "Utilities" | "Maintenance" | "Supplies" | "Events" | "Transport" | "IT & software" | "Other";

export interface Expense {
  id: string;
  voucherNo: string;
  date: ISODate;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  recordedBy: string;
}

/** Monthly salary of one teacher or staff member (৳). */
export interface Salary {
  id: string;
  person: PersonRef;
  basic: number;
  houseRent: number;
  medical: number;
  conveyance: number;
  bankAccount: string;
}

export interface PayrollLine {
  person: PersonRef;
  gross: number;
  providentFund: number;
  tax: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  month: string; // "2026-10"
  lines: PayrollLine[];
  status: "DRAFT" | "PAID";
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
}

// ── Transport ────────────────────────────────────────────────────────────

export interface BusRoute {
  id: string;
  code: string;
  name: string;
  stops: string[];
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  monthlyFee: number;
  departure: string; // first pickup, "07:10"
}

export interface TransportAssignment {
  id: string;
  studentId: string;
  routeId: string;
  stop: string;
  since: ISODate;
}

// ── Hostel ───────────────────────────────────────────────────────────────

export interface Hostel {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  warden: string;
  wardenPhone: string;
}

export interface HostelRoom {
  id: string;
  hostelId: string;
  number: string;
  floor: number;
  capacity: number;
  monthlyRent: number;
}

export interface HostelAllocation {
  id: string;
  studentId: string;
  roomId: string;
  from: ISODate;
  to: ISODate | null;
}

// ── Certificates ─────────────────────────────────────────────────────────

export type CertificateType = "TESTIMONIAL" | "STUDENTSHIP" | "CHARACTER";

export interface CertificateIssue {
  id: string;
  serialNo: string;
  type: CertificateType;
  studentId: string;
  purpose: string | null;
  issuedOn: ISODate;
  issuedBy: string;
}

// ── Cross-office workflows ───────────────────────────────────────────────

export interface WorkflowEvent {
  at: ISODateTime;
  by: string;
  text: string;
}

export type CertificateRequestStatus = "SUBMITTED" | "AWAITING_FEE" | "ISSUED" | "REJECTED";

/** Student → Registrar verifies → Accounts collects the fee → Document office issues. */
export interface CertificateRequest {
  id: string;
  requestNo: string;
  studentId: string;
  type: CertificateType;
  purpose: string | null;
  status: CertificateRequestStatus;
  invoiceId: string | null;
  certificateId: string | null;
  requestedAt: ISODateTime;
  history: WorkflowEvent[];
}

export type ClearanceOffice = "ACCOUNTS" | "LIBRARY" | "HOSTEL" | "TRANSPORT" | "DEPARTMENT";

export interface ClearanceRequest {
  id: string;
  studentId: string;
  reason: "GRADUATION" | "WITHDRAWAL" | "TRANSFER";
  requestedAt: ISODateTime;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED";
  signoffs: Partial<Record<ClearanceOffice, { by: string; at: ISODateTime }>>;
  decidedBy: string | null;
  decidedAt: ISODateTime | null;
  history: WorkflowEvent[];
}

export type TicketStatus = "SUBMITTED" | "ASSIGNED" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";

/** Student Affairs ticket: complaints, counselling, record corrections. */
export interface Ticket {
  id: string;
  ticketNo: string;
  studentId: string;
  category: string;
  subject: string;
  body: string;
  confidential: boolean;
  status: TicketStatus;
  assignee: string | null;
  createdAt: ISODateTime;
  history: WorkflowEvent[];
}

export interface AttendanceCorrection {
  id: string;
  sheetId: string;
  studentId: string;
  from: AttendanceMark;
  to: AttendanceMark;
  reason: string;
  requestedBy: string;
  requestedAt: ISODateTime;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  decidedAt: ISODateTime | null;
}

export interface DemoDb {
  version: number;
  seededAt: ISODateTime;
  counters: Record<string, number>;
  faculties: Faculty[];
  departments: Department[];
  programs: Program[];
  courses: Course[];
  semesters: Semester[];
  teachers: Teacher[];
  sections: Section[];
  routine: RoutineSlot[];
  guardians: Guardian[];
  students: Student[];
  applications: Application[];
  attendance: AttendanceSheet[];
  exams: Exam[];
  marks: Mark[];
  publications: ResultPublication[];
  feeStructures: FeeStructure[];
  scholarships: Scholarship[];
  invoices: Invoice[];
  payments: Payment[];
  staff: Staff[];
  notices: Notice[];
  leaves: LeaveRequest[];
  books: Book[];
  bookIssues: BookIssue[];
  expenses: Expense[];
  salaries: Salary[];
  payrollRuns: PayrollRun[];
  routes: BusRoute[];
  transport: TransportAssignment[];
  hostels: Hostel[];
  rooms: HostelRoom[];
  allocations: HostelAllocation[];
  certificates: CertificateIssue[];
  certificateRequests: CertificateRequest[];
  clearances: ClearanceRequest[];
  tickets: Ticket[];
  corrections: AttendanceCorrection[];
}
