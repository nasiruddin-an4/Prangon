"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { invoiceStatus, invoiceTotals, lookup, methodLabel, nextCounter, nowIso, PAYMENT_METHODS, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Invoice, PaymentMethod, Student } from "@/lib/demo/types";
import { studentDue } from "@/lib/demo/workflows";
import { InfoGrid, PrintButton } from "@/components/demo";
import { PortalPage } from "@/components/portal";
import { INVOICE_TONE, statusLabel } from "@/components/students";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

const ONLINE = PAYMENT_METHODS.filter((m) => m.key !== "CASH" && m.key !== "BANK");
const KIND = { SEMESTER: "Semester fee", FINE: "Fine", CERTIFICATE: "Certificate fee" } as const;

export default function PortalAccounts() {
  return (
    <PortalPage title="Fees & payments" description="Your invoices, fines and payments. Pay online with bKash, Nagad, Rocket or card, and download receipts.">
      {({ db, student }) => <Accounts db={db} student={student} />}
    </PortalPage>
  );
}

function Accounts({ db, student }: { db: DemoDb; student: Student }) {
  const today = todayDhaka();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const invoices = db.invoices.filter((i) => i.studentId === student.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const payments = db.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const scholarship = db.scholarships.find((s) => s.studentIds.includes(student.id));
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding" value={taka(studentDue(db, student.id))} icon="wallet" />
        <StatCard label="Paid so far" value={taka(paid)} icon="check" />
        <StatCard label="Invoices" value={invoices.length} icon="fileText" />
        <StatCard label="Scholarship" value={scholarship ? `${scholarship.percent}%` : "—"} sub={scholarship?.name} icon="award" />
      </div>
      <Card title="Invoices & charges" description="Fines from the library and certificate fees appear here too">
        <Table head={["Invoice", "For", "Payable", "Paid", "Due", "Status", ""]} empty={!invoices.length && <EmptyState icon="wallet" title="No invoices" />}>
          {invoices.map((inv) => {
            const t = invoiceTotals(inv, db.payments);
            const st = invoiceStatus(inv, db.payments, today);
            return (
              <Tr key={inv.id}>
                <Td>
                  <p className="font-mono text-xs">{inv.invoiceNo}</p>
                  <p className="text-xs text-muted">due {formatDate(inv.dueDate)}</p>
                </Td>
                <Td>
                  <p>{KIND[inv.kind ?? "SEMESTER"]}</p>
                  <p className="max-w-56 truncate text-xs text-muted">{inv.kind && inv.kind !== "SEMESTER" ? inv.items[0]?.label : lookup(db.semesters, inv.semesterId)?.name}</p>
                </Td>
                <Td className="tabular-nums">{taka(t.net)}</Td>
                <Td className="text-success tabular-nums">{taka(t.paid)}</Td>
                <Td className={t.due ? "font-medium text-danger tabular-nums" : "tabular-nums"}>{taka(t.due)}</Td>
                <Td>
                  <Badge tone={INVOICE_TONE[st]} dot>
                    {statusLabel(st)}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {t.due > 0 && (
                    <Button size="sm" onClick={() => setPaying(inv)}>
                      Pay now
                    </Button>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Payment history">
        <Table head={["Receipt", "Date", "Amount", "Method", ""]} empty={!payments.length && <EmptyState icon="receipt" title="No payments yet" />}>
          {payments.map((p) => (
            <Tr key={p.id}>
              <Td>
                <p className="font-mono text-xs">{p.receiptNo}</p>
                {p.transactionId && <p className="font-mono text-[11px] text-muted">{p.transactionId}</p>}
              </Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(p.paidAt)}</Td>
              <Td className="font-medium tabular-nums">{taka(p.amount)}</Td>
              <Td>{methodLabel(p.method)}</Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" icon="receipt" onClick={() => setReceipt(p.id)}>
                  Receipt
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Pay online">
        {paying && (
          <PayForm
            db={db}
            invoice={paying}
            onDone={(paymentId) => {
              setPaying(null);
              setReceipt(paymentId);
            }}
            onCancel={() => setPaying(null)}
          />
        )}
      </Modal>
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Payment receipt">
        {receipt && <Receipt db={db} paymentId={receipt} onClose={() => setReceipt(null)} />}
      </Modal>
    </div>
  );
}

/**
 * Demo of the online payment step. In production this hands over to the
 * bKash / Nagad / SSLCommerz checkout and the gateway's callback records the
 * payment; here the student types the transaction ID they'd receive.
 */
function PayForm({ db, invoice, onDone, onCancel }: { db: DemoDb; invoice: Invoice; onDone: (paymentId: string) => void; onCancel: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const due = invoiceTotals(invoice, db.payments).due;
  const [method, setMethod] = useState<PaymentMethod>("BKASH");
  const [amount, setAmount] = useState(String(due));
  const [txn, setTxn] = useState("");
  const [error, setError] = useState<string | null>(null);

  function pay() {
    const value = Number(amount);
    if (!(value > 0) || value > due) return setError(`Enter an amount between ৳1 and ${taka(due)}.`);
    if (txn.trim().length < 6) return setError(`Enter the ${methodLabel(method)} transaction ID.`);
    if (db.payments.some((p) => p.transactionId?.toUpperCase() === txn.trim().toUpperCase())) return setError("This transaction ID was already used.");
    const id = crypto.randomUUID();
    let receiptNo = "";
    update((d) => {
      receiptNo = `RCT-${todayDhaka().slice(0, 4)}-${String(nextCounter(d, "receipt")).padStart(5, "0")}`;
      d.payments.push({ id, receiptNo, invoiceId: invoice.id, studentId: invoice.studentId, amount: value, method, transactionId: txn.trim().toUpperCase(), paidAt: nowIso(), collectedBy: "Student portal (online)" });
    });
    toast(`${taka(value)} paid · receipt ${receiptNo}`);
    onDone(id);
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">Demo payment: no money moves. In production this opens the {methodLabel(method)} checkout.</p>
      <InfoGrid
        items={[
          ["Invoice", invoice.invoiceNo],
          ["Due", taka(due)],
        ]}
      />
      <Field label="Pay with">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {ONLINE.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount (৳)" hint="You can pay in part">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Transaction ID" hint="From the confirmation SMS">
        <Input value={txn} onChange={(e) => setTxn(e.target.value)} className="font-mono uppercase" placeholder="e.g. 9KX2M4P7QA" />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={pay}>Pay {taka(Number(amount) || 0)}</Button>
      </FormActions>
    </div>
  );
}

function Receipt({ db, paymentId, onClose }: { db: DemoDb; paymentId: string; onClose: () => void }) {
  const { tenant } = useAuth();
  const p = lookup(db.payments, paymentId);
  if (!p) return null;
  const inv = lookup(db.invoices, p.invoiceId);
  const s = lookup(db.students, p.studentId);
  return (
    <div>
      <div className="print-area space-y-4 rounded-xl border border-border p-5">
        <div className="flex justify-between border-b border-dashed border-border pb-3">
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
            ["Received from", s?.name],
            ["Student ID", s?.studentId],
            ["Against", inv ? `${inv.invoiceNo} · ${inv.items.map((i) => i.label).join(", ").slice(0, 60)}` : "—"],
            ["Method", methodLabel(p.method)],
            ["Transaction ID", p.transactionId],
            ["Received by", p.collectedBy],
          ]}
        />
        <div className="flex justify-between rounded-lg bg-success/10 px-4 py-3">
          <span className="text-sm font-medium">Amount</span>
          <span className="text-xl font-semibold text-success tabular-nums">{taka(p.amount)}</span>
        </div>
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
