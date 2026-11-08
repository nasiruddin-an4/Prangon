/**
 * Demo data for a Bangladeshi private university: faculties, programs,
 * sections with a clash-free routine, ~60 students with guardians, a month of
 * attendance, marks, fee invoices and bKash/Nagad/cash payments, and an
 * admission intake. Generated from a fixed seed, so every browser gets the
 * same records.
 */
import { generateStudentId, markTotal, PERIODS, routineClash, WEEKDAYS } from "./logic";
import { seedServices } from "./services-seed";
import { CERTIFICATE_FEE, raiseCharge } from "./workflows";
import type {
  Application,
  ApplicationStatus,
  AttendanceMark,
  AttendanceSheet,
  Course,
  DemoDb,
  Department,
  Gender,
  Guardian,
  Invoice,
  Mark,
  Payment,
  PaymentMethod,
  Program,
  RoutineSlot,
  Section,
  Teacher,
  Weekday,
} from "./types";

export const DEMO_VERSION = 4;
const DEFAULT_ID_FORMAT = "{YY}{DEPT}{SEQ:4}";

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]!,
    chance: (p: number) => next() < p,
  };
}

const MALE = ["Tanvir", "Rakib", "Sabbir", "Arif", "Imran", "Nayeem", "Fahim", "Shakib", "Mehedi", "Rifat", "Mahmudul", "Ashik", "Tahsin", "Zubair", "Sakib", "Mushfiq", "Rashed", "Siam", "Arnab", "Junayed", "Towhid", "Riyad"];
const FEMALE = ["Nusrat", "Farzana", "Sadia", "Tasnim", "Anika", "Jannatul", "Sumaiya", "Raisa", "Tahmina", "Lamia", "Fariha", "Nabila", "Maliha", "Ishrat", "Sharmin", "Tanjila", "Afsana", "Priyanka", "Mithila", "Sanjida"];
const SURNAMES = ["Hossain", "Rahman", "Islam", "Ahmed", "Chowdhury", "Khan", "Sarker", "Uddin", "Karim", "Haque", "Talukder", "Siddique", "Mahmud", "Alam", "Bhuiyan", "Das", "Roy", "Paul"];
const FATHER_FIRST = ["Abdul", "Mohammad", "Md. Nurul", "Md. Abul", "Shahidul", "Anwar", "Delwar", "Jahangir", "Kamal", "Mizanur", "Rafiqul", "Harun"];
const MOTHER_FIRST = ["Rokeya", "Salma", "Nasima", "Shirin", "Rehana", "Parveen", "Hasina", "Laila", "Morium", "Shahnaz"];
const OCCUPATIONS = ["Businessman", "Government service", "Teacher", "Farmer", "Bank officer", "Engineer", "Doctor", "Private service", "Expatriate (KSA)", "Homemaker"];
const PLACES: Record<string, string[]> = {
  Dhaka: ["Dhaka", "Gazipur", "Narayanganj", "Tangail", "Narsingdi", "Munshiganj"],
  Chattogram: ["Chattogram", "Cumilla", "Feni", "Noakhali", "Cox's Bazar", "Brahmanbaria"],
  Rajshahi: ["Rajshahi", "Bogura", "Pabna", "Naogaon"],
  Khulna: ["Khulna", "Jashore", "Kushtia", "Satkhira"],
  Sylhet: ["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"],
  Barishal: ["Barishal", "Patuakhali", "Bhola"],
  Rangpur: ["Rangpur", "Dinajpur", "Kurigram"],
  Mymensingh: ["Mymensingh", "Jamalpur", "Netrokona"],
};
const DIVISION_WEIGHTS = ["Dhaka", "Dhaka", "Dhaka", "Chattogram", "Chattogram", "Rajshahi", "Khulna", "Sylhet", "Barishal", "Rangpur", "Mymensingh"];

const SEM_FALL = "sem-fall-2026";

export function createDemoDb(today: string): DemoDb {
  const r = rng(20261108);
  const db: DemoDb = {
    version: DEMO_VERSION,
    seededAt: new Date().toISOString(),
    counters: {},
    faculties: [
      { id: "fac-fse", name: "Faculty of Science & Engineering", code: "FSE" },
      { id: "fac-fbs", name: "Faculty of Business Studies", code: "FBS" },
      { id: "fac-fah", name: "Faculty of Arts & Humanities", code: "FAH" },
    ],
    departments: [],
    programs: [],
    courses: [],
    semesters: [
      { id: "sem-spring-2026", name: "Spring 2026", startDate: "2026-01-10", endDate: "2026-05-31", status: "COMPLETED" },
      { id: "sem-summer-2026", name: "Summer 2026", startDate: "2026-06-01", endDate: "2026-08-31", status: "COMPLETED" },
      { id: SEM_FALL, name: "Fall 2026", startDate: "2026-09-01", endDate: "2026-12-31", status: "ONGOING" },
      { id: "sem-spring-2027", name: "Spring 2027", startDate: "2027-01-10", endDate: "2027-05-31", status: "UPCOMING" },
    ],
    teachers: [],
    sections: [],
    routine: [],
    guardians: [],
    students: [],
    applications: [],
    attendance: [],
    exams: [
      { id: "exam-ct1", semesterId: SEM_FALL, name: "Class Test 1", type: "CLASS_TEST", startDate: "2026-09-27", endDate: "2026-10-01" },
      { id: "exam-mid", semesterId: SEM_FALL, name: "Midterm Examination", type: "MIDTERM", startDate: "2026-10-18", endDate: "2026-10-27" },
      { id: "exam-ct2", semesterId: SEM_FALL, name: "Class Test 2", type: "CLASS_TEST", startDate: "2026-11-22", endDate: "2026-11-26" },
      { id: "exam-final", semesterId: SEM_FALL, name: "Final Examination", type: "FINAL", startDate: "2026-12-13", endDate: "2026-12-24" },
    ],
    marks: [],
    publications: [],
    feeStructures: [],
    scholarships: [],
    invoices: [],
    payments: [],
    staff: [],
    notices: [],
    leaves: [],
    books: [],
    bookIssues: [],
    expenses: [],
    salaries: [],
    payrollRuns: [],
    routes: [],
    transport: [],
    hostels: [],
    rooms: [],
    allocations: [],
    certificates: [],
    certificateRequests: [],
    clearances: [],
    tickets: [],
    corrections: [],
  };

  // ── Academic structure ────────────────────────────────────────────────
  const dept = (id: string, facultyId: string, code: string, name: string): Department => ({ id, facultyId, code, name });
  db.departments = [
    dept("dep-cse", "fac-fse", "CSE", "Computer Science & Engineering"),
    dept("dep-eee", "fac-fse", "EEE", "Electrical & Electronic Engineering"),
    dept("dep-ns", "fac-fse", "NS", "Natural Sciences"),
    dept("dep-bba", "fac-fbs", "BBA", "Business Administration"),
    dept("dep-eng", "fac-fah", "ENG", "English"),
  ];
  const prog = (id: string, departmentId: string, code: string, name: string, durationSemesters: number, totalCredits: number): Program => ({
    id, departmentId, code, name, degree: "BACHELOR", durationSemesters, totalCredits,
  });
  db.programs = [
    prog("prg-cse", "dep-cse", "BSC-CSE", "B.Sc. in Computer Science & Engineering", 12, 160),
    prog("prg-eee", "dep-eee", "BSC-EEE", "B.Sc. in Electrical & Electronic Engineering", 12, 160),
    prog("prg-bba", "dep-bba", "BBA", "Bachelor of Business Administration", 8, 130),
    prog("prg-eng", "dep-eng", "BA-ENG", "B.A. (Hons) in English", 8, 124),
  ];
  const c = (code: string, title: string, credits: number, departmentId: string, type: Course["type"] = "THEORY"): Course => ({
    id: `crs-${code.toLowerCase()}`, code, title, credits, departmentId, type,
  });
  db.courses = [
    c("CSE101", "Structured Programming Language", 3, "dep-cse"),
    c("CSE102", "Structured Programming Lab", 1.5, "dep-cse", "LAB"),
    c("CSE201", "Data Structures", 3, "dep-cse"),
    c("CSE202", "Data Structures Lab", 1.5, "dep-cse", "LAB"),
    c("CSE205", "Discrete Mathematics", 3, "dep-cse"),
    c("CSE207", "Digital Logic Design", 3, "dep-cse"),
    c("EEE101", "Electrical Circuits I", 3, "dep-eee"),
    c("EEE102", "Electrical Circuits Lab", 1.5, "dep-eee", "LAB"),
    c("EEE105", "Electronic Devices", 3, "dep-eee"),
    c("MAT101", "Differential & Integral Calculus", 3, "dep-ns"),
    c("PHY101", "Physics I", 3, "dep-ns"),
    c("CHE101", "Engineering Chemistry", 3, "dep-ns"),
    c("BUS101", "Principles of Management", 3, "dep-bba"),
    c("ACC101", "Principles of Accounting", 3, "dep-bba"),
    c("ECO101", "Microeconomics", 3, "dep-bba"),
    c("MKT101", "Principles of Marketing", 3, "dep-bba"),
    c("ENG101", "English Language I", 3, "dep-eng"),
    c("ENG111", "Introduction to Literature", 3, "dep-eng"),
    c("ENG112", "Phonetics & Phonology", 3, "dep-eng"),
    c("ENG114", "History of the English Language", 3, "dep-eng"),
  ];

  const t = (id: string, name: string, designation: Teacher["designation"], departmentId: string, slug: string): Teacher => ({
    id, name, designation, departmentId, email: `${slug}@demo.edu.bd`, phone: `01${r.pick(["7", "8", "9", "5", "6", "3"])}${String(r.int(10000000, 99999999))}`,
  });
  db.teachers = [
    t("tch-1", "Dr. Mohammad Kamrul Hasan", "Professor", "dep-cse", "kamrul"),
    t("tch-2", "Dr. Farhana Yasmin", "Associate Professor", "dep-cse", "farhana"),
    t("tch-3", "Md. Saiful Islam", "Assistant Professor", "dep-cse", "saiful"),
    t("tch-4", "Nadia Afrin", "Lecturer", "dep-cse", "nadia"),
    t("tch-5", "Dr. Abu Sayeed", "Professor", "dep-eee", "sayeed"),
    t("tch-6", "Tanzila Rahman", "Lecturer", "dep-eee", "tanzila"),
    t("tch-7", "Dr. Rezaul Karim", "Associate Professor", "dep-ns", "rezaul"),
    t("tch-8", "Shamima Nasrin", "Assistant Professor", "dep-ns", "shamima"),
    t("tch-9", "Dr. Mahbubur Rahman", "Professor", "dep-bba", "mahbub"),
    t("tch-10", "Sabrina Sultana", "Lecturer", "dep-bba", "sabrina"),
    t("tch-11", "Dr. Selina Akter", "Associate Professor", "dep-eng", "selina"),
    t("tch-12", "Ahsan Habib", "Lecturer", "dep-eng", "ahsan"),
  ];

  const courseId = (code: string) => `crs-${code.toLowerCase()}`;
  const teacherLoad = new Map<string, number>();
  const assignTeacher = (code: string) => {
    const course = db.courses.find((x) => x.id === courseId(code))!;
    const candidates = db.teachers.filter((x) => x.departmentId === course.departmentId);
    candidates.sort((a, b) => (teacherLoad.get(a.id) ?? 0) - (teacherLoad.get(b.id) ?? 0));
    const chosen = candidates[0]!;
    teacherLoad.set(chosen.id, (teacherLoad.get(chosen.id) ?? 0) + 1);
    return chosen.id;
  };
  const section = (id: string, programId: string, name: string, batch: string, room: string, codes: string[]): Section => ({
    id, programId, semesterId: SEM_FALL, name, batch, room, courses: codes.map((code) => ({ courseId: courseId(code), teacherId: assignTeacher(code) })),
  });
  db.sections = [
    section("sec-cse-61a", "prg-cse", "CSE-61A", "61", "AB1-301", ["CSE101", "CSE102", "MAT101", "PHY101", "ENG101"]),
    section("sec-cse-61b", "prg-cse", "CSE-61B", "61", "AB1-302", ["CSE101", "CSE102", "MAT101", "PHY101", "ENG101"]),
    section("sec-cse-58a", "prg-cse", "CSE-58A", "58", "AB1-405", ["CSE201", "CSE202", "CSE205", "CSE207"]),
    section("sec-eee-40a", "prg-eee", "EEE-40A", "40", "AB2-201", ["EEE101", "EEE102", "MAT101", "CHE101"]),
    section("sec-bba-35a", "prg-bba", "BBA-35A", "35", "AB3-110", ["BUS101", "ACC101", "ECO101", "MKT101"]),
    section("sec-eng-22a", "prg-eng", "ENG-22A", "22", "AB3-214", ["ENG111", "ENG112", "ENG114", "ENG101"]),
  ];

  // ── Routine: theory twice a week, labs once, with no clashes ──────────
  db.sections.forEach((sec, si) => {
    sec.courses.forEach(({ courseId: cid, teacherId }, ci) => {
      const course = db.courses.find((x) => x.id === cid)!;
      const sessions = course.type === "LAB" ? 1 : 2;
      const room = course.type === "LAB" ? `${db.departments.find((d) => d.id === course.departmentId)!.code}-Lab-${(si % 2) + 1}` : sec.room;
      let placed = 0;
      const usedDays = new Set<Weekday>();
      for (let k = 0; k < WEEKDAYS.length * PERIODS.length && placed < sessions; k++) {
        const day = WEEKDAYS[(si + ci * 2 + k) % WEEKDAYS.length]!.key;
        const period = PERIODS[(ci + Math.floor(k / WEEKDAYS.length) + si) % PERIODS.length]!;
        if (usedDays.has(day)) continue;
        const slot: Omit<RoutineSlot, "id"> = { sectionId: sec.id, courseId: cid, teacherId, day, start: period.start, end: period.end, room };
        if (routineClash(db, slot)) continue;
        db.routine.push({ id: `rt-${sec.id}-${cid}-${placed}`, ...slot });
        usedDays.add(day);
        placed++;
      }
    });
  });

  // ── Students & guardians ──────────────────────────────────────────────
  const phone = () => `01${r.pick(["3", "4", "5", "6", "7", "8", "9"])}${String(r.int(10000000, 99999999))}`;
  const admissionYear: Record<string, number> = { "61": 2026, "58": 2025, "40": 2025, "35": 2026, "22": 2026 };
  const sizes: Record<string, number> = { "sec-cse-61a": 12, "sec-cse-61b": 10, "sec-cse-58a": 11, "sec-eee-40a": 9, "sec-bba-35a": 10, "sec-eng-22a": 8 };
  const usedNames = new Set<string>();
  const attendanceBias = new Map<string, number>();

  for (const sec of db.sections) {
    const program = db.programs.find((p) => p.id === sec.programId)!;
    const deptCode = db.departments.find((d) => d.id === program.departmentId)!.code;
    const year = admissionYear[sec.batch]!;
    for (let i = 0; i < sizes[sec.id]!; i++) {
      const gender: Gender = r.chance(0.45) ? "FEMALE" : "MALE";
      let name: string;
      do {
        name = `${r.pick(gender === "MALE" ? MALE : FEMALE)} ${r.pick(gender === "FEMALE" && r.chance(0.3) ? ["Akter", "Khatun", "Sultana"] : SURNAMES)}`;
      } while (usedNames.has(name));
      usedNames.add(name);
      const surname = name.split(" ").at(-1)!;
      const division = r.pick(DIVISION_WEIGHTS);
      const father: Guardian = {
        id: `grd-${db.guardians.length + 1}`,
        name: `${r.pick(FATHER_FIRST)} ${["Akter", "Khatun", "Sultana"].includes(surname) ? r.pick(SURNAMES) : surname}`,
        relation: "Father",
        phone: phone(),
        email: r.chance(0.3) ? `guardian${db.guardians.length + 1}@gmail.com` : null,
        occupation: r.pick(OCCUPATIONS.slice(0, -1)),
      };
      db.guardians.push(father);
      const guardianIds = [father.id];
      if (r.chance(0.35)) {
        const mother: Guardian = { id: `grd-${db.guardians.length + 1}`, name: `${r.pick(MOTHER_FIRST)} Begum`, relation: "Mother", phone: phone(), email: null, occupation: r.pick(["Homemaker", "Teacher", "Government service"]) };
        db.guardians.push(mother);
        guardianIds.push(mother.id);
      }
      const id = `stu-${db.students.length + 1}`;
      const status = r.chance(0.04) ? "SUSPENDED" : "ACTIVE";
      db.students.push({
        id,
        studentId: generateStudentId(db, DEFAULT_ID_FORMAT, { year, dept: deptCode, campus: null }),
        name,
        gender,
        dateOfBirth: `${year - r.int(18, 20)}-${String(r.int(1, 12)).padStart(2, "0")}-${String(r.int(1, 28)).padStart(2, "0")}`,
        bloodGroup: r.chance(0.85) ? r.pick(["A+", "B+", "O+", "AB+", "A-", "B-", "O-"]) : null,
        phone: phone(),
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@student.demo.edu.bd`,
        programId: program.id,
        sectionId: sec.id,
        batch: sec.batch,
        campus: null,
        admissionDate: year === 2026 ? "2026-08-20" : "2025-08-24",
        status,
        division,
        district: r.pick(PLACES[division]!),
        address: `House ${r.int(1, 120)}, Road ${r.int(1, 30)}`,
        guardianIds,
        createdAt: `${year}-08-${year === 2026 ? "20" : "24"}T10:00:00.000Z`,
      });
      // A few students skip a lot of classes, so the attendance warnings have something to show.
      attendanceBias.set(id, r.chance(0.15) ? 0.55 + r.next() * 0.15 : 0.82 + r.next() * 0.16);
    }
  }

  // ── Attendance: every scheduled class from semester start to yesterday ─
  const dayKey = (iso: string): Weekday | null => {
    const d = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
    return (["SUN", "MON", "TUE", "WED", "THU", null, "SAT"] as const)[d] ?? null;
  };
  const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const from = addDays(today, -35) > "2026-09-01" ? addDays(today, -35) : "2026-09-01";
  for (let date = from; date < today; date = addDays(date, 1)) {
    const wd = dayKey(date);
    if (!wd) continue; // Friday
    for (const slot of db.routine.filter((s) => s.day === wd)) {
      if (db.attendance.some((a) => a.sectionId === slot.sectionId && a.courseId === slot.courseId && a.date === date)) continue;
      const marks: Record<string, AttendanceMark> = {};
      for (const s of db.students.filter((x) => x.sectionId === slot.sectionId)) {
        const p = attendanceBias.get(s.id)!;
        marks[s.id] = r.chance(p) ? (r.chance(0.08) ? "L" : "P") : "A";
      }
      const teacher = db.teachers.find((x) => x.id === slot.teacherId);
      db.attendance.push({ id: `att-${db.attendance.length + 1}`, sectionId: slot.sectionId, courseId: slot.courseId, date, marks, takenBy: teacher?.name ?? "Demo", takenAt: `${date}T${slot.end}:00.000+06:00` } satisfies AttendanceSheet);
    }
  }

  // ── Marks: class tests and midterm everywhere; finals for two sections ─
  const finalsDone = new Set(["sec-cse-58a", "sec-bba-35a"]);
  for (const sec of db.sections) {
    for (const { courseId: cid } of sec.courses) {
      for (const s of db.students.filter((x) => x.sectionId === sec.id)) {
        const ability = (attendanceBias.get(s.id)! - 0.5) * 1.6 + r.next() * 0.35; // ~0.2 – 1.1
        const part = (max: number) => Math.min(max, Math.max(0, Math.round(max * Math.min(0.98, 0.35 + ability * 0.6 + (r.next() - 0.5) * 0.2))));
        const mark: Mark = {
          id: `mrk-${db.marks.length + 1}`,
          sectionId: sec.id,
          courseId: cid,
          studentId: s.id,
          attendance: Math.round(attendanceBias.get(s.id)! * 10),
          classTest: part(20),
          midterm: part(30),
          final: finalsDone.has(sec.id) ? part(40) : null,
        };
        if (mark.final !== null && markTotal(mark) < 40 && r.chance(0.6)) mark.final = Math.min(40, mark.final + 8);
        db.marks.push(mark);
      }
    }
  }
  db.publications.push({ sectionId: "sec-bba-35a", publishedAt: "2026-11-05T11:30:00.000Z", publishedBy: "Controller of Examinations" });

  // ── Fees ──────────────────────────────────────────────────────────────
  const fee = (programId: string, tuition: number, lab: number) => ({
    id: `fee-${programId}`,
    programId,
    name: "Semester fee",
    items: [
      { label: "Tuition fee", amount: tuition },
      ...(lab ? [{ label: "Lab fee", amount: lab }] : []),
      { label: "Library fee", amount: 1500 },
      { label: "Development fee", amount: 3000 },
      { label: "Exam fee", amount: 2500 },
    ],
  });
  db.feeStructures = [fee("prg-cse", 55000, 6000), fee("prg-eee", 52000, 6000), fee("prg-bba", 48000, 0), fee("prg-eng", 36000, 0)];

  const studentsByMerit = [...db.students].sort((a, b) => avgTotal(db, b.id) - avgTotal(db, a.id));
  db.scholarships = [
    { id: "sch-merit", name: "Merit scholarship", percent: 50, studentIds: studentsByMerit.slice(0, 4).map((s) => s.id) },
    { id: "sch-sibling", name: "Sibling waiver", percent: 20, studentIds: studentsByMerit.slice(20, 23).map((s) => s.id) },
    { id: "sch-need", name: "Need-based support", percent: 30, studentIds: studentsByMerit.slice(40, 43).map((s) => s.id) },
  ];

  const METHODS: PaymentMethod[] = ["BKASH", "BKASH", "BKASH", "BKASH", "CASH", "CASH", "NAGAD", "NAGAD", "BANK", "BANK", "SSLCOMMERZ", "ROCKET"];
  const collectors = ["Accounts Office", "Md. Jashim (Cashier)", "Online gateway"];
  for (const s of db.students) {
    const structure = db.feeStructures.find((f) => f.programId === s.programId)!;
    const scholarship = db.scholarships.find((x) => x.studentIds.includes(s.id));
    const tuition = structure.items.find((i) => i.label === "Tuition fee")!.amount;
    const invoice: Invoice = {
      id: `inv-${db.invoices.length + 1}`,
      invoiceNo: `INV-2026-${String(db.invoices.length + 1).padStart(5, "0")}`,
      studentId: s.id,
      semesterId: SEM_FALL,
      items: structure.items.map((i) => ({ ...i })),
      discount: scholarship ? Math.round((tuition * scholarship.percent) / 100) : 0,
      discountLabel: scholarship ? `${scholarship.name} (${scholarship.percent}% of tuition)` : null,
      dueDate: s.batch === "61" || s.batch === "35" || s.batch === "22" ? "2026-11-30" : "2026-10-31",
      issuedAt: "2026-09-01T04:00:00.000Z",
    };
    db.invoices.push(invoice);
    const net = invoice.items.reduce((sum, i) => sum + i.amount, 0) - invoice.discount;
    const roll = r.next();
    const plan = roll < 0.55 ? [net] : roll < 0.65 ? [Math.round(net / 2), net - Math.round(net / 2)] : roll < 0.85 ? [Math.round(net * r.pick([0.3, 0.4, 0.5]))] : [];
    plan.forEach((amount, k) => {
      const method = r.pick(METHODS);
      const day = addDays("2026-09-03", r.int(0, 25) + k * 30);
      if (day >= today) return;
      const receipt = db.payments.length + 1;
      db.payments.push({
        id: `pay-${receipt}`,
        receiptNo: `RCT-2026-${String(receipt).padStart(5, "0")}`,
        invoiceId: invoice.id,
        studentId: s.id,
        amount,
        method,
        transactionId: method === "CASH" ? null : `${method.slice(0, 3)}${Math.floor(r.next() * 36 ** 7).toString(36).toUpperCase().padStart(7, "0")}`,
        paidAt: `${day}T${String(r.int(9, 16)).padStart(2, "0")}:${String(r.int(0, 59)).padStart(2, "0")}:00.000+06:00`,
        collectedBy: method === "SSLCOMMERZ" ? collectors[2]! : r.pick(collectors.slice(0, 2)),
      } satisfies Payment);
    });
  }
  db.counters.invoice = db.invoices.length;
  db.counters.receipt = db.payments.length;

  // ── Admissions: the Spring 2027 intake ────────────────────────────────
  const statuses: ApplicationStatus[] = [
    ...Array<ApplicationStatus>(9).fill("SUBMITTED"),
    ...Array<ApplicationStatus>(6).fill("UNDER_REVIEW"),
    ...Array<ApplicationStatus>(5).fill("ACCEPTED"),
    ...Array<ApplicationStatus>(3).fill("REJECTED"),
  ];
  statuses.forEach((status, i) => {
    const gender: Gender = r.chance(0.45) ? "FEMALE" : "MALE";
    let name: string;
    do {
      name = `${r.pick(gender === "MALE" ? MALE : FEMALE)} ${r.pick(SURNAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const division = r.pick(DIVISION_WEIGHTS);
    const hsc = status === "REJECTED" ? r.pick([2.75, 3.0, 3.17]) : r.pick([3.5, 3.83, 4.0, 4.25, 4.5, 4.67, 4.83, 5.0]);
    const appliedDaysAgo = r.int(1, 40);
    const appliedAt = new Date(Date.parse(`${today}T00:00:00Z`) - appliedDaysAgo * 86400000 + r.int(9, 20) * 3600000).toISOString();
    const application: Application = {
      id: `app-${i + 1}`,
      applicationNo: `ADM-2027-${String(i + 1).padStart(4, "0")}`,
      name,
      gender,
      dateOfBirth: `${2008 - r.int(0, 1)}-${String(r.int(1, 12)).padStart(2, "0")}-${String(r.int(1, 28)).padStart(2, "0")}`,
      phone: phone(),
      email: r.chance(0.7) ? `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com` : null,
      programId: r.pick(["prg-cse", "prg-cse", "prg-cse", "prg-eee", "prg-bba", "prg-bba", "prg-eng"]),
      sscGpa: Math.min(5, hsc + r.pick([0, 0.25, 0.5])),
      hscGpa: hsc,
      hscYear: 2026,
      board: r.pick(["Dhaka", "Dhaka", "Chattogram", "Rajshahi", "Cumilla", "Jashore", "Sylhet", "Madrasah"]),
      guardianName: `${r.pick(FATHER_FIRST)} ${name.split(" ").at(-1)}`,
      guardianRelation: "Father",
      guardianPhone: phone(),
      division,
      district: r.pick(PLACES[division]!),
      status,
      testScore: status === "SUBMITTED" ? null : status === "REJECTED" ? r.int(28, 39) : r.int(55, 92),
      notes: status === "REJECTED" ? "Did not meet the admission test cut-off (40)." : null,
      appliedAt,
      decidedAt: status === "ACCEPTED" || status === "REJECTED" ? new Date(Date.parse(appliedAt) + 5 * 86400000).toISOString() : null,
      studentId: null,
    };
    db.applications.push(application);
  });
  db.counters.application = db.applications.length;

  db.staff = seedStaff();
  db.notices = seedNotices(today);
  addServices(db, today);
  addWorkflows(db, today);
  return db;
}

/** A few requests at different stages, so each office has something in its queue. */
function addWorkflows(db: DemoDb, today: string) {
  db.certificateRequests = [];
  db.clearances = [];
  db.tickets = [];
  db.corrections = [];
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const at = (daysAgo: number, hour = 11) => new Date(Date.parse(`${today}T00:00:00Z`) - daysAgo * 86400000 + (hour - 6) * 3600000).toISOString();
  const ev = (daysAgo: number, by: string, text: string) => ({ at: at(daysAgo), by, text });
  const s = (i: number) => active[i % active.length]!;

  // Certificate requests: one waiting for the Registrar, one waiting for its fee.
  db.certificateRequests.push({
    id: "crq-1", requestNo: "REQ-2026-0001", studentId: s(5).id, type: "STUDENTSHIP", purpose: "Visa application (Malaysia)", status: "SUBMITTED",
    invoiceId: null, certificateId: null, requestedAt: at(1), history: [ev(1, s(5).name, "Requested from the student portal")],
  });
  const fee = raiseCharge(db, s(12).id, "CERTIFICATE", "Certificate fee · Character certificate", CERTIFICATE_FEE, today);
  db.certificateRequests.push({
    id: "crq-2", requestNo: "REQ-2026-0002", studentId: s(12).id, type: "CHARACTER", purpose: "Scholarship application", status: "AWAITING_FEE",
    invoiceId: fee.id, certificateId: null, requestedAt: at(4),
    history: [ev(4, s(12).name, "Requested from the student portal"), ev(3, "Md. Abdur Rahim", `Verified by the Registrar; fee of ৳${CERTIFICATE_FEE} raised at Accounts (${fee.invoiceNo})`)],
  });
  db.counters.certificateRequest = 2;

  // Student Affairs tickets.
  const ticket = (n: number, i: number, category: string, subject: string, body: string, status: DemoDb["tickets"][number]["status"], assignee: string | null, history: DemoDb["tickets"][number]["history"], confidential = false) =>
    db.tickets.push({ id: `tk-${n}`, ticketNo: `TKT-2026-${String(n).padStart(4, "0")}`, studentId: s(i).id, category, subject, body, confidential, status, assignee, createdAt: history[0]!.at, history });
  ticket(1, 2, "Facilities", "Air conditioner not working in AB1-301", "The AC in AB1-301 has not worked for a week. Afternoon classes are very hot.", "UNDER_REVIEW", "Abul Kalam", [ev(6, s(2).name, "Submitted"), ev(5, "Students' Affairs", "Assigned to Abul Kalam"), ev(3, "Abul Kalam", "Technician visit booked for Thursday")]);
  ticket(2, 9, "Accounts", "bKash payment not reflected", "I paid ৳20,000 by bKash on 2 November (TrxID 9KX2M4P7QA) but my invoice still shows the full due.", "SUBMITTED", null, [ev(1, s(9).name, "Submitted")]);
  ticket(3, 15, "Record correction", "Spelling of father's name", "My father's name is spelled wrongly on my profile. Requesting correction as per my SSC certificate.", "RESOLVED", "Registrar's Office", [ev(10, s(15).name, "Submitted"), ev(9, "Students' Affairs", "Assigned to Registrar's Office"), ev(7, "Registrar's Office", "Corrected after checking the SSC certificate")]);
  ticket(4, 21, "Harassment / ragging", "Senior students harassing juniors at the hall", "Details shared in person with the proctor.", "ASSIGNED", "Proctor Office", [ev(2, s(21).name, "Submitted"), ev(2, "Students' Affairs", "Assigned to Proctor Office (confidential)")], true);
  db.counters.ticket = 4;

  // A graduation clearance part-way through.
  db.clearances.push({
    id: "clr-1", studentId: s(30).id, reason: "WITHDRAWAL", requestedAt: at(3), status: "IN_PROGRESS",
    signoffs: { TRANSPORT: { by: "Transport Office", at: at(2) } }, decidedBy: null, decidedAt: null,
    history: [ev(3, "Registrar's Office", "Clearance started: transfer to another university"), ev(2, "Transport Office", "Transport cleared")],
  });

  // A teacher's pending attendance correction.
  const sheet = [...db.attendance].reverse().find((a) => Object.values(a.marks).includes("A"));
  if (sheet) {
    const studentId = Object.entries(sheet.marks).find(([, m]) => m === "A")![0];
    db.corrections.push({ id: "cor-1", sheetId: sheet.id, studentId, from: "A", to: "P", reason: "Student was present; marked absent by mistake during roll call.", requestedBy: sheet.takenBy, requestedAt: at(0, 9), status: "PENDING", decidedBy: null, decidedAt: null });
  }
}

function addServices(db: DemoDb, today: string) {
  const { counters, ...data } = seedServices(db, today);
  Object.assign(db, data);
  Object.assign(db.counters, counters);
}

function seedStaff(): DemoDb["staff"] {
  const s = (id: string, name: string, designation: string, office: string, slug: string, phone: string, joinedOn: string, status: DemoDb["staff"][number]["status"] = "ACTIVE") => ({
    id, name, designation, office, email: `${slug}@demo.edu.bd`, phone, joinedOn, status,
  });
  return [
    s("stf-1", "Md. Abdur Rahim", "Registrar", "Registrar's Office", "registrar", "01711000101", "2015-03-01"),
    s("stf-2", "Shahana Parvin", "Deputy Registrar", "Registrar's Office", "shahana", "01711000102", "2018-07-15"),
    s("stf-3", "Kazi Moinul Islam", "Controller of Examinations", "Exam Controller's Office", "controller", "01711000103", "2016-01-10"),
    s("stf-4", "Md. Jashim Uddin", "Cashier", "Accounts", "jashim", "01811000104", "2019-02-01"),
    s("stf-5", "Rumana Ahmed", "Accounts Officer", "Accounts", "rumana", "01811000105", "2020-09-01"),
    s("stf-6", "Habibur Rahman", "Librarian", "Library", "librarian", "01911000106", "2017-05-20"),
    s("stf-7", "Tanvir Hasan", "System Administrator", "IT", "it", "01611000107", "2021-11-01"),
    s("stf-8", "Nasrin Sultana", "Admission Officer", "Admission Office", "admission", "01511000108", "2022-01-05", "ON_LEAVE"),
    s("stf-9", "Abul Kalam", "Office Assistant", "Administration", "kalam", "01311000109", "2014-08-01"),
  ];
}

function seedNotices(today: string): DemoDb["notices"] {
  const at = (daysAgo: number, hour = 10) => new Date(Date.parse(`${today}T00:00:00Z`) - daysAgo * 86400000 + (hour - 6) * 3600000).toISOString();
  return [
    { id: "ntc-1", title: "Class Test 2 schedule published", body: "Class Test 2 for all Fall 2026 sections runs 22–26 November. Check the exam schedule for your course times. Bring your student ID card.", audience: "STUDENTS", sectionId: null, pinned: true, publishedAt: at(1), expiresOn: "2026-11-26", author: "Exam Controller's Office" },
    { id: "ntc-2", title: "Semester fee deadline: 30 November", body: "First-year students must clear the Fall 2026 semester fee by 30 November. Pay by bKash, Nagad, card or at the Accounts counter. A late fee applies after the deadline.", audience: "GUARDIANS", sectionId: null, pinned: true, publishedAt: at(3), expiresOn: "2026-11-30", author: "Accounts" },
    { id: "ntc-3", title: "Campus closed on 16 December (Victory Day)", body: "The university remains closed on 16 December for Victory Day. Classes resume on 17 December.", audience: "EVERYONE", sectionId: null, pinned: false, publishedAt: at(2), expiresOn: "2026-12-17", author: "Registrar's Office" },
    { id: "ntc-4", title: "Faculty meeting: final exam question moderation", body: "All course teachers must submit final exam questions to their department head by 1 December. The moderation meeting is on 3 December at 11:00 in the Conference Room.", audience: "TEACHERS", sectionId: null, pinned: false, publishedAt: at(4), expiresOn: null, author: "Office of the Dean" },
    { id: "ntc-5", title: "CSE-61A: make-up class for CSE101", body: "A make-up class for CSE101 (Structured Programming Language) will be held on Thursday at 14:45 in AB1-301.", audience: "STUDENTS", sectionId: "sec-cse-61a", pinned: false, publishedAt: at(0, 9), expiresOn: null, author: "Dr. Mohammad Kamrul Hasan" },
    { id: "ntc-6", title: "Annual sports week registration open", body: "Register for football, cricket, badminton and chess at the Students' Affairs office by 25 November.", audience: "STUDENTS", sectionId: null, pinned: false, publishedAt: at(6), expiresOn: "2026-11-25", author: "Students' Affairs" },
  ];
}

/** Adds what newer versions introduced to data saved by an older version, keeping the user's changes. */
export function migrateDemoDb(db: DemoDb, today: string): DemoDb {
  if (db.version === 1) {
    db.staff = seedStaff();
    db.notices = seedNotices(today);
    db.version = 2;
  }
  if (db.version === 2) {
    addServices(db, today);
    db.version = 3;
  }
  if (db.version === 3) {
    addWorkflows(db, today);
    db.version = 4;
  }
  return db;
}

function avgTotal(db: DemoDb, studentId: string) {
  const marks = db.marks.filter((m) => m.studentId === studentId);
  return marks.reduce((s, m) => s + (m.classTest ?? 0) + (m.midterm ?? 0), 0) / Math.max(1, marks.length);
}
