"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, nextCounter, nowIso, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { CertificateType, DemoDb, Student } from "@/lib/demo/types";
import { TICKET_CATEGORIES, TICKET_TONE, Timeline } from "@/components/workflow-ui";
import { certificateStage, CERTIFICATE_FEE, CLEARANCE_OFFICES, clearanceChecks, STAGE_LABEL } from "@/lib/demo/workflows";
import { PrintButton, Tabs, Textarea } from "@/components/demo";
import { CERT, Certificate } from "@/components/certificate";
import { Icon } from "@/components/icons";
import { PortalPage } from "@/components/portal";
import { Badge, Button, Card, cx, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, Select, useToast } from "@/components/ui";

type Tab = "certificates" | "support" | "clearance";
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

export default function PortalServices() {
  const [tab, setTab] = useState<Tab>("certificates");
  return (
    <PortalPage title="Certificates & support" description="Request certificates, raise a complaint or support request, and track your clearance, without visiting each office.">
      {({ db, student }) => (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "certificates", label: "Certificates", count: db.certificateRequests.filter((r) => r.studentId === student.id).length },
              { key: "support", label: "Complaints & support", count: db.tickets.filter((t) => t.studentId === student.id).length },
              { key: "clearance", label: "Clearance" },
            ]}
          />
          {tab === "certificates" && <Certificates db={db} student={student} />}
          {tab === "support" && <Support db={db} student={student} />}
          {tab === "clearance" && <Clearance db={db} student={student} />}
        </>
      )}
    </PortalPage>
  );
}

// ── Certificates ─────────────────────────────────────────────────────────

const STEPS = ["SUBMITTED", "AWAITING_FEE", "READY", "ISSUED"] as const;

function Certificates({ db, student }: { db: DemoDb; student: Student }) {
  const { tenant } = useAuth();
  const [applying, setApplying] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const requests = db.certificateRequests.filter((r) => r.studentId === student.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const issued = lookup(db.certificates, viewing);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 text-sm">
        <p className="text-muted">
          Registrar verifies your record → you pay the ৳{CERTIFICATE_FEE} fee → the Document office issues it.
        </p>
        <Button icon="plus" onClick={() => setApplying(true)}>
          Request a certificate
        </Button>
      </div>
      {requests.length === 0 && (
        <Card>
          <EmptyState icon="award" title="No certificate requests" />
        </Card>
      )}
      {requests.map((r) => {
        const stage = certificateStage(db, r);
        const reached = stage === "REJECTED" ? -1 : STEPS.indexOf(stage);
        return (
          <Card key={r.id} title={`${CERT[r.type].label} · ${r.requestNo}`} description={r.purpose ?? undefined} actions={<Badge tone={stage === "ISSUED" ? "success" : stage === "REJECTED" ? "danger" : "warning"} dot>{STAGE_LABEL[stage]}</Badge>}>
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px]">
              <div>
                {stage !== "REJECTED" && (
                  <ol className="mb-5 grid grid-cols-4 gap-2 text-center text-[11px]">
                    {STEPS.map((s, i) => (
                      <li key={s} className={cx("rounded-lg px-2 py-2", i <= reached ? "bg-accent-soft font-medium text-accent" : "bg-surface-2 text-subtle")}>
                        {i < reached && <Icon name="check" className="mx-auto mb-0.5 size-3.5" />}
                        {STAGE_LABEL[s]}
                      </li>
                    ))}
                  </ol>
                )}
                <Timeline events={r.history} />
              </div>
              <div className="space-y-2 text-sm">
                {stage === "AWAITING_FEE" && <p className="rounded-lg bg-warning/10 px-3 py-2 text-warning">Pay the ৳{CERTIFICATE_FEE} fee under Fees &amp; payments to continue.</p>}
                {stage === "ISSUED" && r.certificateId && (
                  <Button variant="secondary" icon="printer" onClick={() => setViewing(r.certificateId)}>
                    View &amp; print
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      <Modal open={applying} onClose={() => setApplying(false)} title="Request a certificate">
        {applying && <RequestForm db={db} student={student} onDone={() => setApplying(false)} />}
      </Modal>
      <Modal open={!!issued} onClose={() => setViewing(null)} title={issued ? `${CERT[issued.type].label} · ${issued.serialNo}` : ""} size="lg">
        {issued && (
          <>
            <Certificate db={db} institution={tenant?.name ?? ""} type={issued.type} student={student} purpose={issued.purpose} serial={issued.serialNo} date={issued.issuedOn} />
            <FormActions>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
              <PrintButton label="Print" />
            </FormActions>
          </>
        )}
      </Modal>
    </div>
  );
}

function RequestForm({ db, student, onDone }: { db: DemoDb; student: Student; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const types = (Object.keys(CERT) as CertificateType[]).filter((t) => CERT[t].allowed(student));
  const [type, setType] = useState<CertificateType | undefined>(types[0]);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!type) return <p className="text-sm text-muted">No certificates are available for your current status.</p>;
  return (
    <div className="grid gap-4">
      <Field label="Certificate">
        <Select value={type} onChange={(e) => setType(e.target.value as CertificateType)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {CERT[t].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Purpose" hint="Printed on the certificate">
        <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Passport application" />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (purpose.trim().length < 3) return setError("Say what the certificate is for.");
            if (db.certificateRequests.some((r) => r.studentId === student.id && r.type === type && (r.status === "SUBMITTED" || r.status === "AWAITING_FEE"))) return setError("You already have this certificate in progress.");
            let no = "";
            update((d) => {
              no = `REQ-${todayDhaka().slice(0, 4)}-${String(nextCounter(d, "certificateRequest")).padStart(4, "0")}`;
              d.certificateRequests.push({ id: crypto.randomUUID(), requestNo: no, studentId: student.id, type, purpose: purpose.trim(), status: "SUBMITTED", invoiceId: null, certificateId: null, requestedAt: nowIso(), history: [{ at: nowIso(), by: student.name, text: "Requested from the student portal" }] });
            });
            toast(`Request ${no} sent to the Registrar`);
            onDone();
          }}
        >
          Send request
        </Button>
      </FormActions>
    </div>
  );
}

// ── Support tickets ──────────────────────────────────────────────────────


function Support({ db, student }: { db: DemoDb; student: Student }) {
  const { update } = useDemo();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]!);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickets = db.tickets.filter((t) => t.studentId === student.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function submit() {
    if (subject.trim().length < 5) return setError("Add a short subject.");
    if (body.trim().length < 10) return setError("Describe the problem.");
    let no = "";
    update((d) => {
      no = `TKT-${todayDhaka().slice(0, 4)}-${String(nextCounter(d, "ticket")).padStart(4, "0")}`;
      d.tickets.push({ id: crypto.randomUUID(), ticketNo: no, studentId: student.id, category, subject: subject.trim(), body: body.trim(), confidential: confidential || category === "Harassment / ragging", status: "SUBMITTED", assignee: null, createdAt: nowIso(), history: [{ at: nowIso(), by: student.name, text: "Submitted from the student portal" }] });
    });
    toast(`${no} sent to Student Affairs`);
    setCreating(false);
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 text-sm">
        <p className="text-muted">Student Affairs assigns each request to the right office and keeps you updated here.</p>
        <Button icon="plus" onClick={() => setCreating(true)}>
          New request
        </Button>
      </div>
      {tickets.length === 0 && (
        <Card>
          <EmptyState icon="megaphone" title="No requests yet" />
        </Card>
      )}
      {tickets.map((t) => (
        <Card key={t.id} title={`${t.subject}`} description={`${t.ticketNo} · ${t.category}${t.assignee ? ` · with ${t.assignee}` : ""}`} actions={<Badge tone={TICKET_TONE[t.status]} dot>{label(t.status)}</Badge>}>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px]">
            <p className="text-sm whitespace-pre-line text-muted">{t.body}</p>
            <Timeline events={t.history} />
          </div>
        </Card>
      ))}
      <Modal open={creating} onClose={() => setCreating(false)} title="New complaint or support request">
        <div className="grid gap-4">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Details">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-28" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={confidential || category === "Harassment / ragging"} disabled={category === "Harassment / ragging"} onChange={(e) => setConfidential(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Confidential: only senior Student Affairs staff can read the details
          </label>
          <ErrorNote message={error} />
          <FormActions>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Send</Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}

// ── Clearance ────────────────────────────────────────────────────────────

function Clearance({ db, student }: { db: DemoDb; student: Student }) {
  const { update } = useDemo();
  const toast = useToast();
  const request = [...db.clearances].reverse().find((c) => c.studentId === student.id);
  const checks = clearanceChecks(db, student.id);
  const [reason, setReason] = useState<"GRADUATION" | "WITHDRAWAL" | "TRANSFER">("GRADUATION");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card title="Clearance status" description={request ? `${label(request.reason)} clearance · started ${formatDate(request.requestedAt)}` : "Where you stand today with each office"}>
        <ul className="divide-y divide-border">
          {CLEARANCE_OFFICES.map((o) => {
            const signed = request?.signoffs[o.key];
            return (
              <li key={o.key} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className={cx("grid size-7 place-items-center rounded-full", signed ? "bg-success/15 text-success" : checks[o.key].ok ? "bg-surface-3 text-muted" : "bg-danger/12 text-danger")}>
                  <Icon name={signed ? "check" : checks[o.key].ok ? "clock" : "alert"} className="size-3.5" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-xs text-muted">{signed ? `Cleared by ${signed.by}, ${formatDate(signed.at)}` : checks[o.key].detail}</span>
                </span>
                {signed ? <Badge tone="success">Cleared</Badge> : checks[o.key].ok ? <Badge>Waiting for sign-off</Badge> : <Badge tone="danger">Action needed</Badge>}
              </li>
            );
          })}
          <li className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className={cx("grid size-7 place-items-center rounded-full", request?.status === "APPROVED" ? "bg-success/15 text-success" : "bg-surface-3 text-muted")}>
              <Icon name={request?.status === "APPROVED" ? "check" : "clock"} className="size-3.5" />
            </span>
            <span className="flex-1 font-medium">Registrar (final approval)</span>
            {request ? <Badge tone={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "neutral"}>{label(request.status)}</Badge> : <Badge>Not started</Badge>}
          </li>
        </ul>
      </Card>
      <Card title="Apply for clearance" description="Needed for graduation, withdrawal or transfer">
        <div className="space-y-3 p-5">
          {request && request.status === "IN_PROGRESS" ? (
            <p className="text-sm text-muted">Your clearance is in progress. Each office signs off once its check passes.</p>
          ) : (
            <>
              <Field label="Reason">
                <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                  <option value="GRADUATION">Graduation</option>
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="TRANSFER">Transfer to another university</option>
                </Select>
              </Field>
              <Button
                className="w-full"
                onClick={() => {
                  update((d) => {
                    d.clearances.push({ id: crypto.randomUUID(), studentId: student.id, reason, requestedAt: nowIso(), status: "IN_PROGRESS", signoffs: {}, decidedBy: null, decidedAt: null, history: [{ at: nowIso(), by: student.name, text: `Applied for ${reason.toLowerCase()} clearance from the student portal` }] });
                  });
                  toast("Clearance request sent to every office");
                }}
              >
                Apply
              </Button>
            </>
          )}
          {request && <Timeline events={request.history} />}
        </div>
      </Card>
    </div>
  );
}
