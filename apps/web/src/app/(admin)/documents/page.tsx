"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, newId, nextCounter, nowIso, todayDhaka } from "@/lib/demo/logic";
import { certificateStage, CERTIFICATE_FEE, raiseCharge, STAGE_LABEL } from "@/lib/demo/workflows";
import { useDemo } from "@/lib/demo/store";
import type { CertificateIssue, CertificateRequest, CertificateType, DemoDb } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, PrintButton, Tabs, Toolbar } from "@/components/demo";
import { IdCard } from "@/components/id-card";
import { CERT, Certificate } from "@/components/certificate";
import { Badge, Button, Card, cx, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

type Tab = "requests" | "cards" | "certificates" | "log";


export default function DocumentsPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <>
      <PageHeader eyebrow="Students" title="ID cards & certificates" description="Print student and staff ID cards in bulk, and issue numbered certificates with a register of everything issued." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active students" value={db.students.filter((s) => s.status === "ACTIVE").length} icon="idCard" />
            <StatCard label="Teachers & staff" value={db.teachers.length + db.staff.filter((s) => s.status !== "RESIGNED").length} icon="users" />
            <StatCard label="Certificates issued" value={db.certificates.length} icon="award" />
            <StatCard label="This month" value={db.certificates.filter((c) => c.issuedOn.startsWith(todayDhaka().slice(0, 7))).length} icon="calendar" />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "requests", label: "Requests", count: db.certificateRequests.filter((r) => r.status !== "ISSUED" && r.status !== "REJECTED").length },
              { key: "cards", label: "ID cards" },
              { key: "certificates", label: "Issue certificate" },
              { key: "log", label: "Certificate register", count: db.certificates.length },
            ]}
          />
          {tab === "requests" && <Requests db={db} />}
          {tab === "cards" && <IdCards db={db} />}
          {tab === "certificates" && <IssueCertificate db={db} onIssued={() => setTab("log")} />}
          {tab === "log" && <Register db={db} />}
        </>
      )}
    </>
  );
}

// ── Certificate requests (Student → Registrar → Accounts → Document office) ──

function Requests({ db }: { db: DemoDb }) {
  const { can, tenant } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const [rejecting, setRejecting] = useState<CertificateRequest | null>(null);
  const [reason, setReason] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);
  const manage = can("students.manage");
  const today = todayDhaka();
  const rows = [...db.certificateRequests].sort((a, b) => {
    const order = { SUBMITTED: 0, READY: 1, AWAITING_FEE: 2, ISSUED: 3, REJECTED: 4 };
    return order[certificateStage(db, a)] - order[certificateStage(db, b)] || b.requestedAt.localeCompare(a.requestedAt);
  });
  const log = (text: string) => ({ at: nowIso(), by: actor, text });

  const verify = (r: CertificateRequest) => {
    const student = lookup(db.students, r.studentId)!;
    if (!CERT[r.type].allowed(student)) return toast(`${student.name} isn't eligible: ${CERT[r.type].who.toLowerCase()}`, "error");
    let invoiceNo = "";
    update((d) => {
      const x = d.certificateRequests.find((y) => y.id === r.id)!;
      const fee = raiseCharge(d, r.studentId, "CERTIFICATE", `Certificate fee · ${CERT[r.type].label}`, CERTIFICATE_FEE, today);
      invoiceNo = fee.invoiceNo;
      Object.assign(x, { status: "AWAITING_FEE", invoiceId: fee.id });
      x.history.push(log(`Record verified by the Registrar; fee of ৳${CERTIFICATE_FEE} raised at Accounts (${fee.invoiceNo})`));
    });
    toast(`Verified · fee ${invoiceNo} sent to Accounts`);
  };

  const issue = (r: CertificateRequest) => {
    let serial = "";
    update((d) => {
      serial = `CERT-${today.slice(0, 4)}-${String(nextCounter(d, "certificate")).padStart(4, "0")}`;
      const certId = newId();
      d.certificates.push({ id: certId, serialNo: serial, type: r.type, studentId: r.studentId, purpose: r.purpose, issuedOn: today, issuedBy: actor });
      const x = d.certificateRequests.find((y) => y.id === r.id)!;
      Object.assign(x, { status: "ISSUED", certificateId: certId });
      x.history.push(log(`Issued as ${serial}; the student can print it from the portal`));
    });
    toast(`${serial} issued`);
  };

  const printed = lookup(db.certificates, printing);
  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">
          Registrar verifies the record → Accounts collects the ৳{CERTIFICATE_FEE} fee → issued here. Each office acts only on its own step.
        </span>
      </Toolbar>
      <Table head={["Request", "Student", "Certificate", "Stage", ""]} empty={!rows.length && <EmptyState icon="award" title="No requests" description="Students request certificates from their portal." />}>
        {rows.map((r) => {
          const s = lookup(db.students, r.studentId);
          const stage = certificateStage(db, r);
          const fee = lookup(db.invoices, r.invoiceId);
          return (
            <Tr key={r.id}>
              <Td>
                <p className="font-mono text-xs">{r.requestNo}</p>
                <p className="text-xs text-muted">{formatDate(r.requestedAt)}</p>
              </Td>
              <Td>
                <p className="font-medium">{s?.name}</p>
                <p className="font-mono text-xs text-muted">{s?.studentId}</p>
              </Td>
              <Td>
                <p>{CERT[r.type].label}</p>
                <p className="max-w-52 truncate text-xs text-muted">{r.purpose}</p>
              </Td>
              <Td>
                <Badge tone={stage === "ISSUED" ? "success" : stage === "REJECTED" ? "danger" : stage === "READY" ? "accent" : "warning"} dot>
                  {STAGE_LABEL[stage]}
                </Badge>
                {stage === "AWAITING_FEE" && fee && <p className="mt-1 font-mono text-[11px] text-muted">{fee.invoiceNo}</p>}
              </Td>
              <Td className="text-right whitespace-nowrap">
                {manage && stage === "SUBMITTED" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setRejecting(r); setReason(""); }}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => verify(r)}>
                      Verify &amp; raise fee
                    </Button>
                  </>
                )}
                {manage && stage === "READY" && (
                  <Button size="sm" icon="award" onClick={() => issue(r)}>
                    Issue
                  </Button>
                )}
                {stage === "ISSUED" && (
                  <Button size="sm" variant="ghost" icon="printer" onClick={() => setPrinting(r.certificateId)}>
                    Print
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.requestNo ?? ""}`}>
        <div className="grid gap-4">
          <Field label="Reason" hint="The student sees this in their portal">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <FormActions>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 5}
              onClick={() => {
                update((d) => {
                  const x = d.certificateRequests.find((y) => y.id === rejecting!.id)!;
                  x.status = "REJECTED";
                  x.history.push(log(`Rejected by the Registrar: ${reason.trim()}`));
                });
                toast("Request rejected");
                setRejecting(null);
              }}
            >
              Reject request
            </Button>
          </FormActions>
        </div>
      </Modal>
      <Modal open={!!printed} onClose={() => setPrinting(null)} title={printed ? `${CERT[printed.type].label} · ${printed.serialNo}` : ""} size="lg">
        {printed && lookup(db.students, printed.studentId) && (
          <>
            <Certificate db={db} institution={tenant?.name ?? ""} type={printed.type} student={lookup(db.students, printed.studentId)!} purpose={printed.purpose} serial={printed.serialNo} date={printed.issuedOn} />
            <FormActions>
              <Button variant="secondary" onClick={() => setPrinting(null)}>
                Close
              </Button>
              <PrintButton label="Print" />
            </FormActions>
          </>
        )}
      </Modal>
    </Card>
  );
}

// ── ID cards ─────────────────────────────────────────────────────────────

function IdCards({ db }: { db: DemoDb }) {
  const { tenant } = useAuth();
  const [who, setWho] = useState<"students" | "employees">("students");
  const [section, setSection] = useState(db.sections[0]?.id ?? "");
  const students = db.students.filter((s) => s.status === "ACTIVE" && (!section || s.sectionId === section)).sort((a, b) => a.studentId.localeCompare(b.studentId));
  const employees = [
    ...db.teachers.map((t) => ({ id: t.id, name: t.name, role: t.designation, unit: `Department of ${lookup(db.departments, t.departmentId)?.name ?? ""}`, code: `T-${t.id.replace(/\D/g, "").padStart(4, "0")}`, phone: t.phone, blood: null as string | null })),
    ...db.staff.filter((s) => s.status !== "RESIGNED").map((s) => ({ id: s.id, name: s.name, role: s.designation, unit: s.office, code: `S-${s.id.replace(/\D/g, "").padStart(4, "0")}`, phone: s.phone, blood: null as string | null })),
  ];
  const year = Number(todayDhaka().slice(0, 4));

  return (
    <Card>
      <Toolbar>
        <div className="flex rounded-lg border border-border-strong p-0.5 text-sm">
          {(["students", "employees"] as const).map((v) => (
            <button key={v} onClick={() => setWho(v)} className={cx("rounded-md px-3 py-1", who === v ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text")}>
              {v === "students" ? "Students" : "Teachers & staff"}
            </button>
          ))}
        </div>
        {who === "students" && (
          <FilterSelect label="Section" value={section} onChange={setSection}>
            <option value="">All active students</option>
            {db.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FilterSelect>
        )}
        <span className="ml-auto text-xs text-muted">{who === "students" ? students.length : employees.length} cards</span>
        <PrintButton label="Print cards" />
      </Toolbar>
      <div className="print-area grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {who === "students"
          ? students.map((s) => {
              const program = lookup(db.programs, s.programId);
              const validTill = `${Number(s.admissionDate.slice(0, 4)) + Math.ceil((program?.durationSemesters ?? 12) / 3)}-12-31`;
              return (
                <IdCard
                  key={s.id}
                  institution={tenant?.name ?? ""}
                  title="Student ID card"
                  name={s.name}
                  code={s.studentId}
                  lines={[program?.name ?? "", `Batch ${s.batch} · ${lookup(db.sections, s.sectionId)?.name ?? ""}`]}
                  footer={[`Blood ${s.bloodGroup ?? "—"}`, `Valid till ${formatDate(validTill)}`]}
                  emergency={lookup(db.guardians, s.guardianIds[0])?.phone ?? s.phone}
                />
              );
            })
          : employees.map((e) => (
              <IdCard key={e.id} institution={tenant?.name ?? ""} title="Employee ID card" name={e.name} code={e.code} lines={[e.role, e.unit]} footer={[`Issued ${year}`, `Valid till ${formatDate(`${year + 2}-12-31`)}`]} emergency={e.phone} />
            ))}
      </div>
    </Card>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────

function IssueCertificate({ db, onIssued }: { db: DemoDb; onIssued: () => void }) {
  const { can, tenant } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const [type, setType] = useState<CertificateType>("STUDENTSHIP");
  const [studentId, setStudentId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const student = lookup(db.students, studentId);
  const eligible = db.students.filter(CERT[type].allowed).sort((a, b) => a.studentId.localeCompare(b.studentId));
  const manage = can("students.manage");

  function issue() {
    if (!student) return setError("Choose a student.");
    if (!CERT[type].allowed(student)) return setError(`${CERT[type].label}: ${CERT[type].who.toLowerCase()}.`);
    let serial = "";
    update((d) => {
      serial = `CERT-${todayDhaka().slice(0, 4)}-${String(nextCounter(d, "certificate")).padStart(4, "0")}`;
      d.certificates.push({ id: newId(), serialNo: serial, type, studentId: student.id, purpose: purpose.trim() || null, issuedOn: todayDhaka(), issuedBy: actor });
    });
    toast(`${CERT[type].label} ${serial} issued. Print it from the register.`);
    onIssued();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card title="Details">
        <div className="space-y-4 p-5">
          <Field label="Certificate">
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as CertificateType);
                setStudentId("");
              }}
            >
              {(Object.keys(CERT) as CertificateType[]).map((t) => (
                <option key={t} value={t}>
                  {CERT[t].label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="-mt-2 text-xs text-muted">For: {CERT[type].who}</p>
          <Field label="Student">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">{eligible.length ? "Choose…" : "No eligible students"}</option>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentId} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purpose" hint="Printed on the certificate, e.g. Passport application">
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </Field>
          <ErrorNote message={error} />
          {manage ? (
            <Button className="w-full" icon="award" disabled={!student} onClick={issue}>
              Issue certificate
            </Button>
          ) : (
            <p className="text-xs text-muted">Only roles that manage students can issue certificates.</p>
          )}
        </div>
      </Card>
      <Card title="Preview">
        {student ? (
          <Certificate db={db} institution={tenant?.name ?? ""} type={type} student={student} purpose={purpose} serial="(assigned on issue)" date={todayDhaka()} />
        ) : (
          <EmptyState icon="award" title="Choose a student" description="The certificate text appears here, ready to print on letterhead." />
        )}
      </Card>
    </div>
  );
}

function Register({ db }: { db: DemoDb }) {
  const { tenant } = useAuth();
  const [view, setView] = useState<CertificateIssue | null>(null);
  const rows = [...db.certificates].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.serialNo.localeCompare(a.serialNo));
  return (
    <Card>
      <Table head={["Serial", "Certificate", "Student", "Purpose", "Issued", ""]} empty={!rows.length && <EmptyState icon="award" title="Nothing issued yet" />}>
        {rows.map((c) => {
          const s = lookup(db.students, c.studentId);
          return (
            <Tr key={c.id}>
              <Td className="font-mono text-xs">{c.serialNo}</Td>
              <Td>
                <Badge tone="accent">{CERT[c.type].label}</Badge>
              </Td>
              <Td>
                <p className="font-medium">{s?.name}</p>
                <p className="font-mono text-xs text-muted">{s?.studentId}</p>
              </Td>
              <Td className="text-muted">{c.purpose ?? "—"}</Td>
              <Td className="whitespace-nowrap text-muted">
                {formatDate(c.issuedOn)}
                <span className="block text-xs">by {c.issuedBy}</span>
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" icon="printer" onClick={() => setView(c)}>
                  Reprint
                </Button>
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${CERT[view.type].label} · ${view.serialNo}` : ""} size="lg">
        {view && lookup(db.students, view.studentId) && (
          <>
            <Certificate db={db} institution={tenant?.name ?? ""} type={view.type} student={lookup(db.students, view.studentId)!} purpose={view.purpose} serial={view.serialNo} date={view.issuedOn} />
            <FormActions>
              <Button variant="secondary" onClick={() => setView(null)}>
                Close
              </Button>
              <PrintButton label="Print copy" />
            </FormActions>
          </>
        )}
      </Modal>
    </Card>
  );
}
