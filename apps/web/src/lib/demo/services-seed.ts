/**
 * Demo data for leave, library, expenses & payroll, transport, hostel and
 * certificates. Runs after the core seed, so it can refer to its students,
 * teachers and staff.
 */
import { addDays, payslip } from "./logic";
import type { Book, BookIssue, BusRoute, CertificateIssue, DemoDb, Expense, ExpenseCategory, Hostel, HostelAllocation, HostelRoom, LeaveRequest, PayrollRun, PaymentMethod, Salary, Staff, Teacher, TransportAssignment } from "./types";

function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min, pick: <T,>(l: readonly T[]) => l[Math.floor(next() * l.length)]! };
}

type ServiceData = Pick<DemoDb, "leaves" | "books" | "bookIssues" | "expenses" | "salaries" | "payrollRuns" | "routes" | "transport" | "hostels" | "rooms" | "allocations" | "certificates"> & { counters: Record<string, number> };

export function seedServices(db: Pick<DemoDb, "students" | "teachers" | "staff">, today: string): ServiceData {
  const r = rng(8112026);
  const active = db.students.filter((s) => s.status === "ACTIVE");
  const ago = (n: number) => addDays(today, -n);
  const counters: Record<string, number> = {};

  // ── Leave ──
  const leaves: LeaveRequest[] = [];
  const leave = (person: LeaveRequest["person"], type: LeaveRequest["type"], from: string, to: string, days: number, reason: string, status: LeaveRequest["status"], decidedBy: string | null = null) =>
    leaves.push({ id: `lv-${leaves.length + 1}`, person, type, from, to, days, reason, status, appliedAt: `${addDays(from, -3)}T09:30:00.000Z`, decidedAt: status === "PENDING" ? null : `${addDays(from, -2)}T11:00:00.000Z`, decidedBy, remark: status === "REJECTED" ? "Midterm invigilation duty that week." : null });
  leave({ type: "TEACHER", id: "tch-4" }, "SICK", ago(20), ago(18), 3, "Fever; doctor advised rest.", "APPROVED", "Dr. Mohammad Kamrul Hasan");
  leave({ type: "TEACHER", id: "tch-10" }, "CASUAL", ago(12), ago(12), 1, "Family wedding in Cumilla.", "APPROVED", "Dr. Mahbubur Rahman");
  leave({ type: "TEACHER", id: "tch-6" }, "CASUAL", ago(-3), ago(-2), 2, "Attending a workshop at BUET.", "PENDING");
  leave({ type: "TEACHER", id: "tch-12" }, "EARNED", ago(-10), ago(-4), 6, "Hajj travel with family.", "PENDING");
  leave({ type: "TEACHER", id: "tch-3" }, "CASUAL", ago(25), ago(24), 2, "Personal work.", "REJECTED", "Dr. Mohammad Kamrul Hasan");
  leave({ type: "STAFF", id: "stf-8" }, "MATERNITY", ago(30), addDays(today, 82), 96, "Maternity leave.", "APPROVED", "Md. Abdur Rahim");
  leave({ type: "STAFF", id: "stf-9" }, "SICK", ago(5), ago(4), 2, "Back pain.", "APPROVED", "Md. Abdur Rahim");
  leave({ type: "STAFF", id: "stf-4" }, "CASUAL", ago(-1), ago(-1), 1, "Bank work for land registration.", "PENDING");
  for (const [i, reason] of ["Dengue fever; hospital admission.", "Sister's wedding in Sylhet.", "Typhoid; medical certificate attached."].entries()) {
    const s = active[i * 7 + 3]!;
    leave({ type: "STUDENT", id: s.id }, i === 1 ? "OTHER" : "SICK", ago(15 - i * 4), ago(12 - i * 4), 3, reason, i === 2 ? "PENDING" : "APPROVED", i === 2 ? null : "Registrar's Office");
  }

  // ── Library ──
  const b = (title: string, author: string, category: string, publisher: string, copies: number, shelf: string): Book => ({
    id: `bk-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`, title, author, isbn: `978${String(r.int(1000000000, 9999999999))}`, category, publisher, copies, shelf,
  });
  const books: Book[] = [
    b("Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", "Computer Science", "MIT Press", 6, "CS-A1"),
    b("The C Programming Language", "Kernighan & Ritchie", "Computer Science", "Prentice Hall", 8, "CS-A2"),
    b("Data Structures Using C", "Reema Thareja", "Computer Science", "Oxford", 5, "CS-A2"),
    b("Digital Logic and Computer Design", "M. Morris Mano", "Computer Science", "Pearson", 5, "CS-B1"),
    b("Discrete Mathematics and Its Applications", "Kenneth H. Rosen", "Mathematics", "McGraw Hill", 6, "MA-A1"),
    b("Database System Concepts", "Silberschatz, Korth, Sudarshan", "Computer Science", "McGraw Hill", 4, "CS-B2"),
    b("Fundamentals of Electric Circuits", "Alexander & Sadiku", "Electrical Engineering", "McGraw Hill", 5, "EE-A1"),
    b("Electronic Devices and Circuit Theory", "Boylestad & Nashelsky", "Electrical Engineering", "Pearson", 4, "EE-A2"),
    b("Calculus: Early Transcendentals", "James Stewart", "Mathematics", "Cengage", 6, "MA-A2"),
    b("Physics", "Halliday, Resnick & Krane", "Physics", "Wiley", 5, "PH-A1"),
    b("Engineering Chemistry", "Jain & Jain", "Chemistry", "Dhanpat Rai", 3, "CH-A1"),
    b("Principles of Management", "Koontz & Weihrich", "Business", "McGraw Hill", 5, "BU-A1"),
    b("Accounting Principles", "Weygandt, Kimmel & Kieso", "Business", "Wiley", 5, "BU-A2"),
    b("Principles of Economics", "N. Gregory Mankiw", "Business", "Cengage", 4, "BU-B1"),
    b("Marketing Management", "Philip Kotler", "Business", "Pearson", 4, "BU-B2"),
    b("A History of English Literature", "Edward Albert", "Literature", "Oxford", 3, "EN-A1"),
    b("English Phonetics and Phonology", "Peter Roach", "Linguistics", "Cambridge", 3, "EN-A2"),
    b("Gitanjali", "Rabindranath Tagore", "Bangla Literature", "Visva-Bharati", 4, "BN-A1"),
    b("Agnibina", "Kazi Nazrul Islam", "Bangla Literature", "Nazrul Institute", 3, "BN-A1"),
    b("Pather Panchali", "Bibhutibhushan Bandyopadhyay", "Bangla Literature", "Mitra & Ghosh", 3, "BN-A2"),
    b("The Unfinished Memoirs", "Sheikh Mujibur Rahman", "History", "University Press Limited", 5, "HI-A1"),
    b("Bangladesh: A Legacy of Blood", "Anthony Mascarenhas", "History", "Hodder & Stoughton", 2, "HI-A1"),
    b("Clean Code", "Robert C. Martin", "Computer Science", "Prentice Hall", 3, "CS-C1"),
    b("Atomic Habits", "James Clear", "General", "Penguin", 2, "GN-A1"),
  ];
  const bookIssues: BookIssue[] = [];
  const borrowers = [...active.slice(0, 18).map((s) => ({ type: "STUDENT" as const, id: s.id })), { type: "TEACHER" as const, id: "tch-2" }, { type: "TEACHER" as const, id: "tch-11" }];
  borrowers.forEach((who, i) => {
    const book = books[(i * 5) % books.length]!;
    const issuedOn = ago(r.int(3, 30));
    const dueOn = addDays(issuedOn, 14);
    const returned = i % 3 === 0;
    const returnedOn = returned ? addDays(issuedOn, r.int(7, 20)) : null;
    bookIssues.push({
      id: `bi-${i + 1}`, bookId: book.id, borrower: who, issuedOn, dueOn,
      returnedOn: returnedOn && returnedOn < today ? returnedOn : null,
      fine: returnedOn && returnedOn > dueOn ? Math.round((Date.parse(returnedOn) - Date.parse(dueOn)) / 86400000) * 5 : 0,
      issuedBy: "Habibur Rahman",
    });
  });

  // ── Expenses ──
  const expenses: Expense[] = [];
  const METHODS: PaymentMethod[] = ["BANK", "BANK", "CASH", "BKASH"];
  const exp = (date: string, category: ExpenseCategory, description: string, vendor: string, amount: number) => {
    const method = category === "Utilities" || amount > 50000 ? "BANK" : r.pick(METHODS);
    counters.voucher = (counters.voucher ?? 0) + 1;
    expenses.push({ id: `ex-${expenses.length + 1}`, voucherNo: `VCH-2026-${String(counters.voucher).padStart(4, "0")}`, date, category, description, vendor, amount, method, reference: method === "CASH" ? null : `${method.slice(0, 3)}${r.int(100000, 999999)}`, recordedBy: "Rumana Ahmed" });
  };
  for (const month of ["2026-09", "2026-10", "2026-11"]) {
    const d = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
    if (d(10) >= today) break;
    exp(d(8), "Utilities", "Electricity bill", "DESCO", r.int(185000, 240000));
    exp(d(9), "Utilities", "Water and sewerage bill", "Dhaka WASA", r.int(18000, 26000));
    exp(d(5), "IT & software", "Internet (500 Mbps dedicated)", "Link3 Technologies", 65000);
    exp(d(12), "Supplies", "Cleaning supplies and toiletries", "Agora Superstore", r.int(14000, 22000));
    exp(d(15), "Transport", "Diesel for university buses", "Meghna Petroleum", r.int(95000, 130000));
    if (d(18) < today) exp(d(18), "Maintenance", r.pick(["AC servicing, AB1 classrooms", "Generator servicing", "Lab computer repairs", "Lift maintenance contract"]), r.pick(["Walton Service Center", "Energypac", "Ryans Computers", "Otis Bangladesh"]), r.int(25000, 80000));
  }
  exp("2026-09-20", "Events", "Fall 2026 orientation programme", "Dhaka Decorators", 120000);
  exp("2026-10-22", "Supplies", "Midterm exam answer scripts and printing", "Bashundhara Paper Mills", 46000);
  exp("2026-11-03", "Events", "Inter-department debate competition", "Students' Affairs", 35000);

  // ── Salaries & payroll ──
  const BASIC: Record<Teacher["designation"], number> = { Professor: 110000, "Associate Professor": 85000, "Assistant Professor": 65000, Lecturer: 45000 };
  const staffBasic = (s: Staff) => (/^Deputy/.test(s.designation) ? 60000 : /^Registrar$|^Controller/.test(s.designation) ? 90000 : /Officer|Librarian|Administrator/.test(s.designation) ? 45000 : /Cashier/.test(s.designation) ? 30000 : 18000);
  const salary = (person: Salary["person"], basic: number): Salary => ({
    id: `sal-${person.id}`, person, basic, houseRent: Math.round(basic * 0.5), medical: Math.min(10000, Math.round(basic * 0.1)), conveyance: 3000, bankAccount: `DBBL ${r.int(1000, 9999)}-${r.int(100000, 999999)}`,
  });
  const salaries = [...db.teachers.map((t) => salary({ type: "TEACHER", id: t.id }, BASIC[t.designation])), ...db.staff.map((s) => salary({ type: "STAFF", id: s.id }, staffBasic(s)))];
  const payrollRuns: PayrollRun[] = ["2026-09", "2026-10"].map((month) => ({
    id: `pr-${month}`, month, status: "PAID" as const, createdAt: `${month}-26T10:00:00.000Z`, paidAt: `${month}-28T10:00:00.000Z`,
    lines: salaries.map((s) => ({ person: s.person, ...payslip(s) })),
  }));

  // ── Transport ──
  const routes: BusRoute[] = [
    { id: "rt-1", code: "R1", name: "Uttara – Campus", stops: ["Uttara Sector 7", "Airport", "Khilkhet", "Kuril Bishwa Road", "Campus"], vehicleNo: "Dhaka Metro-Ba 11-2345", driverName: "Md. Shahjahan", driverPhone: "01711223301", capacity: 40, monthlyFee: 3000, departure: "07:10" },
    { id: "rt-2", code: "R2", name: "Mirpur – Campus", stops: ["Mirpur 12", "Mirpur 10", "Kazipara", "Agargaon", "Campus"], vehicleNo: "Dhaka Metro-Ba 14-5521", driverName: "Abdul Malek", driverPhone: "01711223302", capacity: 40, monthlyFee: 2800, departure: "07:00" },
    { id: "rt-3", code: "R3", name: "Mohammadpur – Dhanmondi – Campus", stops: ["Mohammadpur Bus Stand", "Shyamoli", "Dhanmondi 27", "Panthapath", "Campus"], vehicleNo: "Dhaka Metro-Ba 12-7788", driverName: "Rafiqul Islam", driverPhone: "01711223303", capacity: 30, monthlyFee: 2500, departure: "07:20" },
    { id: "rt-4", code: "R4", name: "Jatrabari – Motijheel – Campus", stops: ["Jatrabari", "Sayedabad", "Motijheel", "Malibagh", "Campus"], vehicleNo: "Dhaka Metro-Ba 15-1209", driverName: "Nurul Amin", driverPhone: "01711223304", capacity: 30, monthlyFee: 2500, departure: "06:55" },
  ];
  const transport: TransportAssignment[] = active.filter((s) => s.division === "Dhaka").slice(0, 22).map((s, i) => {
    const route = routes[i % routes.length]!;
    return { id: `ta-${i + 1}`, studentId: s.id, routeId: route.id, stop: route.stops[i % (route.stops.length - 1)]!, since: s.admissionDate };
  });

  // ── Hostel ──
  const hostels: Hostel[] = [
    { id: "hs-1", name: "North Hall (Male)", gender: "MALE", warden: "Md. Saiful Islam", wardenPhone: "01811000201" },
    { id: "hs-2", name: "South Hall (Female)", gender: "FEMALE", warden: "Dr. Farhana Yasmin", wardenPhone: "01811000202" },
  ];
  const rooms: HostelRoom[] = hostels.flatMap((h) =>
    [101, 102, 103, 104, 201, 202, 203, 204].map((n) => ({ id: `rm-${h.id}-${n}`, hostelId: h.id, number: String(n), floor: Math.floor(n / 100), capacity: n % 100 === 4 ? 2 : 4, monthlyRent: n % 100 === 4 ? 5500 : 3500 })),
  );
  const allocations: HostelAllocation[] = [];
  for (const h of hostels) {
    const residents = active.filter((s) => s.gender === h.gender && s.division !== "Dhaka").slice(0, 9);
    const hostelRooms = rooms.filter((x) => x.hostelId === h.id);
    residents.forEach((s, i) => {
      const room = hostelRooms[Math.floor(i / 2)]!;
      allocations.push({ id: `al-${allocations.length + 1}`, studentId: s.id, roomId: room.id, from: s.admissionDate, to: null });
    });
  }

  // ── Certificates ──
  const certificates: CertificateIssue[] = active.slice(30, 33).map((s, i) => {
    counters.certificate = (counters.certificate ?? 0) + 1;
    return { id: `ct-${i + 1}`, serialNo: `CERT-2026-${String(counters.certificate).padStart(4, "0")}`, type: (["STUDENTSHIP", "CHARACTER", "STUDENTSHIP"] as const)[i]!, studentId: s.id, purpose: ["Passport application", "Scholarship application", "Bank account opening"][i]!, issuedOn: ago(10 - i * 3), issuedBy: "Md. Abdur Rahim" };
  });

  return { leaves, books, bookIssues, expenses, salaries, payrollRuns, routes, transport, hostels, rooms, allocations, certificates, counters };
}
