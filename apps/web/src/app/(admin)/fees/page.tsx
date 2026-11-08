"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { downloadCsv, invoiceStatus, invoiceTotals, lookup, methodLabel, newId, nextCounter, nowIso, PAYMENT_METHODS, taka, todayDhaka, type InvoiceStatus } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, FeeItem, FeeStructure, Invoice, Payment, PaymentMethod } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, InfoGrid, PrintButton, Progress, Tabs, Toolbar } from "@/components/demo";
import { Icon } from "@/components/icons";
import { INVOICE_TONE, programLine, statusLabel, StudentProfile } from "@/components/students";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

type Tab = "invoices" | "payments" | "structures";
const PAGE_SIZE = 15;

export default function FeesPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("invoices");
  const [profile, setProfile] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Finance" title="Fees & payments" description="Semester invoices, payments by cash, bKash, Nagad, Rocket, card or bank, receipts and fee structures." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Overview db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "invoices", label: "Invoices", count: db.invoices.length },
              { key: "payments", label: "Payments", count: db.payments.length },
              { key: "structures", label: "Fee structures" },
            ]}
          />
          {tab === "invoices" && <Invoices db={db} onOpenStudent={setProfile} onReceipt={setReceipt} />}
          {tab === "payments" && <Payments db={db} onReceipt={setReceipt} onOpenStudent={setProfile} />}
          {tab === "structures" && <Structures db={db} />}
          <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Money receipt">
            {receipt && <Receipt db={db} paymentId={receipt} onClose={() => setReceipt(null)} />}
          </Modal>
        </>
      )}
      <StudentProfile studentId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

function Overview({ db }: { db: DemoDb }) {
  const totals = db.invoices.map((i) => invoiceTotals(i, db.payments));
  const billed = totals.reduce((s, t) => s + t.net, 0);
  const collected = totals.reduce((s, t) => s + t.paid, 0);
  const today = todayDhaka();
  const overdue = db.invoices.filter((i) => invoiceStatus(i, db.payments, today) === "OVERDUE");
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Billed" value={taka(billed)} icon="fileText" />
      <StatCard label="Collected" value={taka(collected)} sub={billed ? `${Math.round((collected / billed) * 100)}%` : undefined} icon="wallet" />
      <StatCard label="Outstanding" value={taka(billed - collected)} icon="clock" />
      <StatCard label="Overdue invoices" value={overdue.length} sub={taka(overdue.reduce((s, i) => s + invoiceTotals(i, db.payments).due, 0))} icon="alert" />
    </div>
  );
}

// ── Invoices ─────────────────────────────────────────────────────────────

function Invoices({ db, onOpenStudent, onReceipt }: { db: DemoDb; onOpenStudent: (id: string) => void; onReceipt: (paymentId: string) => void }) {
  const { can } = useAuth();
  const today = todayDhaka();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [section, setSection] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.invoices
      .map((inv) => ({ inv, student: lookup(db.students, inv.studentId)!, totals: invoiceTotals(inv, db.payments), status: invoiceStatus(inv, db.payments, today) }))
      .filter((r) => r.student && (!q || r.student.name.toLowerCase().includes(q) || r.student.studentId.toLowerCase().includes(q) || r.inv.invoiceNo.toLowerCase().includes(q)) && (!status || r.status === status) && (!section || r.student.sectionId === section))
      .sort((a, b) => b.totals.due - a.totals.due || a.inv.invoiceNo.localeCompare(b.inv.invoiceNo));
  }, [db, query, status, section, today]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={reset(setQuery)} placeholder="Search student, ID or invoice no." />
        <FilterSelect label="Status" value={status} onChange={reset((v: string) => setStatus(v as InvoiceStatus | ""))}>
          <option value="">Any status</option>
          {(["UNPAID", "PARTIAL", "OVERDUE", "PAID"] as const).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Section" value={section} onChange={reset(setSection)}>
          <option value="">All sections</option>
          {db.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(`invoices-${today}.csv`, [
                ["Invoice", "Student ID", "Student", "Semester", "Payable", "Paid", "Due", "Due date", "Status"],
                ...rows.map((r) => [r.inv.invoiceNo, r.student.studentId, r.student.name, lookup(db.semesters, r.inv.semesterId)?.name, r.totals.net, r.totals.paid, r.totals.due, r.inv.dueDate, r.status]),
              ])
            }
          >
            Export CSV
          </Button>
          {can("finance.manage") && (
            <Button size="sm" icon="plus" onClick={() => setGenerating(true)}>
              Generate invoices
            </Button>
          )}
        </div>
      </Toolbar>
      <Table head={["Invoice", "Student", "Payable", "Paid", "Due", "Due date", "Status", ""]} empty={!rows.length && <EmptyState icon="wallet" title="No invoices match" />}>
        {rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(({ inv, student, totals, status: st }) => (
          <Tr key={inv.id}>
            <Td>
              <p className="font-mono text-xs">{inv.invoiceNo}</p>
              <p className="text-xs text-muted">
                {inv.kind === "FINE" ? "Library fine" : inv.kind === "CERTIFICATE" ? "Certificate fee" : lookup(db.semesters, inv.semesterId)?.name}
              </p>
            </Td>
            <Td>
              <button onClick={() => onOpenStudent(student.id)} className="text-left">
                <span className="block font-medium hover:text-accent">{student.name}</span>
                <span className="block text-xs text-muted">
                  {student.studentId} · {programLine(db, student)}
                </span>
              </button>
            </Td>
            <Td className="tabular-nums">{taka(totals.net)}</Td>
            <Td className="text-success tabular-nums">{taka(totals.paid)}</Td>
            <Td className={totals.due ? "font-medium text-danger tabular-nums" : "tabular-nums"}>{taka(totals.due)}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDate(inv.dueDate)}</Td>
            <Td>
              <Badge tone={INVOICE_TONE[st]} dot>
                {statusLabel(st)}
              </Badge>
            </Td>
            <Td className="text-right whitespace-nowrap">
              <Button size="sm" variant={totals.due && can("finance.collect") ? "secondary" : "ghost"} onClick={() => setOpen(inv.id)}>
                {totals.due && can("finance.collect") ? "Collect" : "View"}
              </Button>
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={current} pages={pages} onPage={setPage} />
      <Modal open={!!open} onClose={() => setOpen(null)} title="Invoice" size="lg">
        {open && (
          <InvoiceDetail
            db={db}
            invoiceId={open}
            onClose={() => setOpen(null)}
            onPaid={(paymentId) => {
              setOpen(null);
              onReceipt(paymentId);
            }}
          />
        )}
      </Modal>
      <Modal open={generating} onClose={() => setGenerating(false)} title="Generate semester invoices" description="Uses each program's fee structure and applies scholarships. Students who already have an invoice for the semester are skipped.">
        {generating && <GenerateInvoices db={db} onDone={() => setGenerating(false)} />}
      </Modal>
    </Card>
  );
}

function InvoiceDetail({ db, invoiceId, onClose, onPaid }: { db: DemoDb; invoiceId: string; onClose: () => void; onPaid: (paymentId: string) => void }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const inv = lookup(db.invoices, invoiceId)!;
  const student = lookup(db.students, inv.studentId)!;
  const totals = invoiceTotals(inv, db.payments);
  const payments = db.payments.filter((p) => p.invoiceId === inv.id);
  const [method, setMethod] = useState<PaymentMethod>("BKASH");
  const [error, setError] = useState<string | null>(null);
  const needsTxn = PAYMENT_METHODS.find((m) => m.key === method)?.needsTxn;

  function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    const amount = Number(f.amount);
    if (!(amount > 0)) return setError("Enter an amount greater than zero.");
    if (amount > totals.due) return setError(`The amount is more than the ${taka(totals.due)} due.`);
    if (needsTxn && !f.transactionId) return setError(`Enter the ${methodLabel(method)} transaction ID.`);
    if (f.transactionId && db.payments.some((p) => p.transactionId?.toUpperCase() === f.transactionId!.toUpperCase())) return setError("This transaction ID was already used for another payment.");
    const today = todayDhaka();
    if (f.paidOn! > today) return setError("The payment date can't be in the future.");
    const id = newId();
    let receiptNo = "";
    update((d) => {
      receiptNo = `RCT-${today.slice(0, 4)}-${String(nextCounter(d, "receipt")).padStart(5, "0")}`;
      d.payments.push({
        id,
        receiptNo,
        invoiceId: inv.id,
        studentId: student.id,
        amount,
        method,
        transactionId: f.transactionId ? f.transactionId.toUpperCase() : null,
        paidAt: f.paidOn === today ? nowIso() : `${f.paidOn}T12:00:00.000+06:00`,
        collectedBy: actor,
      } satisfies Payment);
    });
    toast(`${taka(amount)} received · receipt ${receiptNo}`);
    onPaid(id);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={student.name} />
        <div className="flex-1">
          <p className="font-medium">{student.name}</p>
          <p className="text-xs text-muted">
            {student.studentId} · {programLine(db, student)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs">{inv.invoiceNo}</p>
          <p className="text-xs text-muted">
            {lookup(db.semesters, inv.semesterId)?.name} · due {formatDate(inv.dueDate)}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border text-sm">
        {inv.items.map((i) => (
          <div key={i.label} className="flex justify-between border-b border-border px-4 py-2">
            <span className="text-muted">{i.label}</span>
            <span className="tabular-nums">{taka(i.amount)}</span>
          </div>
        ))}
        {inv.discount > 0 && (
          <div className="flex justify-between border-b border-border px-4 py-2 text-success">
            <span>{inv.discountLabel ?? "Discount"}</span>
            <span className="tabular-nums">−{taka(inv.discount)}</span>
          </div>
        )}
        <div className="flex justify-between bg-surface-2/60 px-4 py-2 font-medium">
          <span>Payable</span>
          <span className="tabular-nums">{taka(totals.net)}</span>
        </div>
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between border-t border-border px-4 py-2 text-muted">
            <span>
              Paid {formatDate(p.paidAt)} · {methodLabel(p.method)} {p.transactionId && <span className="font-mono text-xs">({p.transactionId})</span>}
            </span>
            <span className="text-success tabular-nums">−{taka(p.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border px-4 py-2.5 font-semibold">
          <span>Due</span>
          <span className={totals.due ? "text-danger tabular-nums" : "tabular-nums"}>{taka(totals.due)}</span>
        </div>
      </div>

      {totals.due > 0 && can("finance.collect") ? (
        <form onSubmit={collect} className="grid gap-4 rounded-xl border border-accent/25 bg-accent-soft/40 p-4 sm:grid-cols-2">
          <p className="col-span-full text-sm font-semibold">Record a payment</p>
          <Field label="Amount (৳)">
            <Input name="amount" inputMode="numeric" defaultValue={String(totals.due)} required />
          </Field>
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Transaction ID" hint={needsTxn ? "From the bKash/Nagad SMS, gateway or bank slip" : "Not needed for cash"}>
            <Input name="transactionId" disabled={!needsTxn} key={method} className="font-mono uppercase" placeholder={needsTxn ? "e.g. 8N7A6B5C4D" : ""} />
          </Field>
          <Field label="Paid on">
            <Input name="paidOn" type="date" defaultValue={todayDhaka()} max={todayDhaka()} />
          </Field>
          <ErrorNote message={error} />
          <FormActions>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" icon="check">
              Receive payment
            </Button>
          </FormActions>
        </form>
      ) : (
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </FormActions>
      )}
    </div>
  );
}

function GenerateInvoices({ db, onDone }: { db: DemoDb; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [semesterId, setSemesterId] = useState(db.semesters.find((s) => s.status === "ONGOING")?.id ?? db.semesters[0]?.id ?? "");
  const [programId, setProgramId] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const targets = db.students.filter((s) => s.status === "ACTIVE" && (!programId || s.programId === programId) && !db.invoices.some((i) => i.studentId === s.id && i.semesterId === semesterId && (i.kind ?? "SEMESTER") === "SEMESTER"));
  const withoutStructure = targets.filter((s) => !db.feeStructures.some((f) => f.programId === s.programId));
  const ready = targets.filter((s) => db.feeStructures.some((f) => f.programId === s.programId));

  function generate() {
    update((d) => {
      for (const s of ready) {
        const structure = d.feeStructures.find((f) => f.programId === s.programId)!;
        const tuition = structure.items.find((i) => /tuition/i.test(i.label))?.amount ?? 0;
        const sch = d.scholarships.find((x) => x.studentIds.includes(s.id));
        d.invoices.push({
          id: newId(),
          invoiceNo: `INV-${dueDate.slice(0, 4)}-${String(nextCounter(d, "invoice")).padStart(5, "0")}`,
          studentId: s.id,
          semesterId,
          items: structure.items.map((i) => ({ ...i })),
          discount: sch ? Math.round((tuition * sch.percent) / 100) : 0,
          discountLabel: sch ? `${sch.name} (${sch.percent}% of tuition)` : null,
          dueDate,
          issuedAt: nowIso(),
        } satisfies Invoice);
      }
    });
    toast(`${ready.length} invoice${ready.length === 1 ? "" : "s"} issued`);
    onDone();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Semester">
        <Select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          {db.semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Program">
        <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
          <option value="">All programs</option>
          {db.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due date" className="sm:col-span-2">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <div className="col-span-full rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <span className="font-semibold">{ready.length}</span> active students will be invoiced.
        {withoutStructure.length > 0 && <span className="text-warning"> {withoutStructure.length} skipped: their program has no fee structure.</span>}
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!ready.length || !dueDate} onClick={generate}>
          Issue {ready.length} invoices
        </Button>
      </FormActions>
    </div>
  );
}

// ── Payments ─────────────────────────────────────────────────────────────

function Payments({ db, onReceipt, onOpenStudent }: { db: DemoDb; onReceipt: (id: string) => void; onOpenStudent: (id: string) => void }) {
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = query.trim().toLowerCase();
  const rows = db.payments
    .filter((p) => (!method || p.method === method) && (!q || p.receiptNo.toLowerCase().includes(q) || (p.transactionId ?? "").toLowerCase().includes(q) || lookup(db.students, p.studentId)?.name.toLowerCase().includes(q)))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const total = db.payments.reduce((s, p) => s + p.amount, 0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card>
        <Toolbar>
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Receipt, transaction ID or student" />
          <FilterSelect label="Method" value={method} onChange={(v) => { setMethod(v as PaymentMethod | ""); setPage(1); }}>
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </FilterSelect>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(`payments-${todayDhaka()}.csv`, [
                ["Receipt", "Date", "Student ID", "Student", "Amount", "Method", "Transaction ID", "Collected by"],
                ...rows.map((p) => {
                  const s = lookup(db.students, p.studentId);
                  return [p.receiptNo, p.paidAt.slice(0, 10), s?.studentId, s?.name, p.amount, methodLabel(p.method), p.transactionId, p.collectedBy];
                }),
              ])
            }
          >
            Export CSV
          </Button>
        </Toolbar>
        <Table head={["Receipt", "Student", "Amount", "Method", "Date", ""]} empty={!rows.length && <EmptyState icon="receipt" title="No payments match" />}>
          {rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((p) => {
            const s = lookup(db.students, p.studentId);
            return (
              <Tr key={p.id}>
                <Td>
                  <p className="font-mono text-xs">{p.receiptNo}</p>
                  {p.transactionId && <p className="font-mono text-[11px] text-muted">{p.transactionId}</p>}
                </Td>
                <Td>
                  {s && (
                    <button onClick={() => onOpenStudent(s.id)} className="text-left">
                      <span className="block font-medium hover:text-accent">{s.name}</span>
                      <span className="block text-xs text-muted">{s.studentId}</span>
                    </button>
                  )}
                </Td>
                <Td className="font-medium tabular-nums">{taka(p.amount)}</Td>
                <Td>
                  <Badge tone={p.method === "CASH" ? "neutral" : "accent"}>{methodLabel(p.method)}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(p.paidAt)}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" icon="receipt" onClick={() => onReceipt(p.id)}>
                    Receipt
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </Table>
        <Pagination page={current} pages={pages} onPage={setPage} />
      </Card>
      <Card title="By method" description={`${taka(total)} received in ${db.payments.length} payments`}>
        <ul className="space-y-3 p-5">
          {PAYMENT_METHODS.map((m) => {
            const sum = db.payments.filter((p) => p.method === m.key).reduce((s, p) => s + p.amount, 0);
            const pct = total ? Math.round((sum / total) * 100) : 0;
            return (
              <li key={m.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="text-muted tabular-nums">
                    {taka(sum)} · {pct}%
                  </span>
                </div>
                <Progress value={pct} />
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Receipt({ db, paymentId, onClose }: { db: DemoDb; paymentId: string; onClose: () => void }) {
  const { tenant } = useAuth();
  const p = lookup(db.payments, paymentId);
  if (!p) return null;
  const inv = lookup(db.invoices, p.invoiceId)!;
  const s = lookup(db.students, p.studentId)!;
  const totals = invoiceTotals(inv, db.payments);
  return (
    <div>
      <div className="print-area space-y-4 rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-border pb-4">
          <div>
            <p className="font-semibold">{tenant?.name}</p>
            <p className="text-xs text-muted">Money receipt</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold">{p.receiptNo}</p>
            <p className="text-xs text-muted">{formatDate(p.paidAt, true)}</p>
          </div>
        </div>
        <InfoGrid
          items={[
            ["Received from", s.name],
            ["Student ID", s.studentId],
            ["Program", lookup(db.programs, s.programId)?.name],
            ["Against invoice", `${inv.invoiceNo} · ${lookup(db.semesters, inv.semesterId)?.name}`],
            ["Method", methodLabel(p.method)],
            ["Transaction ID", p.transactionId],
          ]}
        />
        <div className="flex items-center justify-between rounded-lg bg-success/10 px-4 py-3">
          <span className="text-sm font-medium">Amount received</span>
          <span className="text-xl font-semibold text-success tabular-nums">{taka(p.amount)}</span>
        </div>
        <p className="text-xs text-muted">
          Remaining due on this invoice: <span className="font-medium text-text">{taka(totals.due)}</span> · Received by {p.collectedBy}
        </p>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <PrintButton label="Print receipt" />
      </FormActions>
    </div>
  );
}

// ── Fee structures ───────────────────────────────────────────────────────

function Structures({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState<{ programId: string; structure: FeeStructure | null } | null>(null);
  const manage = can("finance.manage");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {db.programs.map((p) => {
        const st = db.feeStructures.find((f) => f.programId === p.id);
        const total = st?.items.reduce((s, i) => s + i.amount, 0) ?? 0;
        return (
          <Card
            key={p.id}
            title={p.name}
            description={st ? `${st.name} · ${taka(total)} per semester` : "No fee structure yet"}
            actions={
              manage && (
                <Button size="sm" variant="secondary" icon={st ? "pencil" : "plus"} onClick={() => setEditing({ programId: p.id, structure: st ?? null })}>
                  {st ? "Edit" : "Create"}
                </Button>
              )
            }
          >
            {st ? (
              <ul className="divide-y divide-border text-sm">
                {st.items.map((i) => (
                  <li key={i.label} className="flex justify-between px-5 py-2.5">
                    <span className="text-muted">{i.label}</span>
                    <span className="tabular-nums">{taka(i.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Students in this program can&apos;t be invoiced until a structure exists.</p>
            )}
          </Card>
        );
      })}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Fee structure" description={editing ? lookup(db.programs, editing.programId)?.name : undefined}>
        {editing && <StructureForm programId={editing.programId} structure={editing.structure} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function StructureForm({ programId, structure, onDone }: { programId: string; structure: FeeStructure | null; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [name, setName] = useState(structure?.name ?? "Semester fee");
  const [items, setItems] = useState<{ label: string; amount: string }[]>(
    structure?.items.map((i) => ({ label: i.label, amount: String(i.amount) })) ?? [
      { label: "Tuition fee", amount: "" },
      { label: "Library fee", amount: "1500" },
      { label: "Exam fee", amount: "2500" },
    ],
  );
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed: FeeItem[] = items.filter((i) => i.label.trim() || i.amount.trim()).map((i) => ({ label: i.label.trim(), amount: Number(i.amount) }));
    if (!parsed.length) return setError("Add at least one fee item.");
    if (parsed.some((i) => !i.label || !(i.amount >= 0) || !Number.isFinite(i.amount))) return setError("Each item needs a name and an amount of 0 or more.");
    if (new Set(parsed.map((i) => i.label.toLowerCase())).size !== parsed.length) return setError("Item names must be different.");
    update((d) => {
      const existing = d.feeStructures.find((f) => f.programId === programId);
      if (existing) Object.assign(existing, { name: name.trim() || "Semester fee", items: parsed });
      else d.feeStructures.push({ id: newId(), programId, name: name.trim() || "Semester fee", items: parsed });
    });
    toast("Fee structure saved. It applies to invoices issued from now on.");
    onDone();
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input value={item.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Item, e.g. Lab fee" aria-label="Fee item" />
            <Input value={item.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} inputMode="numeric" placeholder="৳" className="w-36 text-right tabular-nums" aria-label="Amount" />
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded-lg px-2 text-subtle hover:bg-surface-2 hover:text-danger" aria-label="Remove item">
              <Icon name="x" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => setItems([...items, { label: "", amount: "" }])}>
          Add item
        </Button>
      </div>
      <p className="text-right text-sm">
        Total: <span className="font-semibold tabular-nums">{taka(items.reduce((s, i) => s + (Number(i.amount) || 0), 0))}</span>
      </p>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save}>Save structure</Button>
      </FormActions>
    </div>
  );
}

