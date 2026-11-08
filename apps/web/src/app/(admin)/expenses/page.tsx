"use client";

import { confirmAction } from "@/lib/alerts";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadCsv, methodLabel, monthLabel, newId, nextCounter, nowIso, PAYMENT_METHODS, payslip, person, PF_RATE, sameRef, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Expense, ExpenseCategory, PaymentMethod, PayrollLine, PayrollRun, PersonRef, Salary } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, FilterSelect, InfoGrid, PersonCell, PrintButton, Progress, Tabs, Toolbar } from "@/components/demo";
import { Badge, Button, Card, EmptyState, FormActions, formatDate, IconButton, Modal, PageHeader, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

const CATEGORIES: ExpenseCategory[] = ["Utilities", "Maintenance", "Supplies", "Events", "Transport", "IT & software", "Other"];
type Tab = "expenses" | "payroll" | "salaries";

export default function ExpensesPage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("expenses");
  return (
    <>
      <PageHeader eyebrow="Finance" title="Expenses & payroll" description="Running costs with vouchers, monthly salary runs with provident fund and income tax (TDS), and payslips." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Summary db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "expenses", label: "Expenses", count: db.expenses.length },
              { key: "payroll", label: "Payroll runs", count: db.payrollRuns.length },
              { key: "salaries", label: "Salary structure", count: db.salaries.length },
            ]}
          />
          {tab === "expenses" && <Expenses db={db} />}
          {tab === "payroll" && <Payroll db={db} />}
          {tab === "salaries" && <Salaries db={db} />}
        </>
      )}
    </>
  );
}

function Summary({ db }: { db: DemoDb }) {
  const month = todayDhaka().slice(0, 7);
  const spent = db.expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const lastRun = [...db.payrollRuns].sort((a, b) => b.month.localeCompare(a.month))[0];
  const collected = db.payments.filter((p) => p.paidAt.startsWith(month)).reduce((s, p) => s + p.amount, 0);
  const monthlyPayroll = db.salaries.reduce((s, x) => s + payslip(x).gross, 0);
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label={`Expenses in ${monthLabel(month).split(" ")[0]}`} value={taka(spent)} icon="receipt" />
      <StatCard label="Monthly payroll (gross)" value={taka(monthlyPayroll)} sub={`${db.salaries.length} people`} icon="banknote" />
      <StatCard label="Last payroll" value={lastRun ? monthLabel(lastRun.month) : "—"} sub={lastRun ? (lastRun.status === "PAID" ? "paid" : "draft") : undefined} icon="check" />
      <StatCard label={`Fees in ${monthLabel(month).split(" ")[0]}`} value={taka(collected)} icon="wallet" />
    </div>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────

function Expenses({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const months = [...new Set(db.expenses.map((e) => e.date.slice(0, 7)))].sort().reverse();
  const [month, setMonth] = useState(months[0] ?? "");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const rows = db.expenses.filter((e) => (!month || e.date.startsWith(month)) && (!category || e.category === category)).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.map((c) => ({ c, sum: rows.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.sum > 0).sort((a, b) => b.sum - a.sum);
  const item = editing === "new" ? null : editing;
  const manage = can("finance.manage");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card>
        <Toolbar>
          <FilterSelect label="Month" value={month} onChange={setMonth}>
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Category" value={category} onChange={setCategory}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </FilterSelect>
          <span className="ml-auto text-sm font-medium tabular-nums">{taka(total)}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={!rows.length}
            onClick={() => downloadCsv(`expenses-${month || "all"}.csv`, [["Voucher", "Date", "Category", "Description", "Vendor", "Amount", "Method", "Reference"], ...rows.map((e) => [e.voucherNo, e.date, e.category, e.description, e.vendor, e.amount, methodLabel(e.method), e.reference])])}
          >
            Export CSV
          </Button>
          {manage && (
            <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
              Add expense
            </Button>
          )}
        </Toolbar>
        <Table head={["Date", "Expense", "Category", "Amount", "Paid by", ""]} empty={!rows.length && <EmptyState icon="receipt" title="No expenses" />}>
          {rows.map((e) => (
            <Tr key={e.id}>
              <Td className="whitespace-nowrap text-muted">{formatDate(e.date)}</Td>
              <Td>
                <p className="font-medium">{e.description}</p>
                <p className="text-xs text-muted">
                  {e.vendor} · <span className="font-mono">{e.voucherNo}</span>
                </p>
              </Td>
              <Td>
                <Badge>{e.category}</Badge>
              </Td>
              <Td className="font-medium tabular-nums">{taka(e.amount)}</Td>
              <Td className="text-xs text-muted">
                {methodLabel(e.method)}
                {e.reference && <span className="block font-mono">{e.reference}</span>}
              </Td>
              <Td className="text-right">
                {manage && (
                  <IconButton icon="pencil" label="Edit" onClick={() => setEditing(e)} />
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
      <Card title="By category" description={month ? monthLabel(month) : "All months"}>
        <ul className="space-y-3 p-5">
          {byCategory.map((x) => (
            <li key={x.c}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{x.c}</span>
                <span className="text-muted tabular-nums">{taka(x.sum)}</span>
              </div>
              <Progress value={(x.sum / (byCategory[0]?.sum || 1)) * 100} />
            </li>
          ))}
          {!byCategory.length && <li className="text-sm text-muted">Nothing recorded.</li>}
        </ul>
      </Card>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? `Edit ${item.voucherNo}` : "Add expense"}>
        <EntityForm
          fields={[
            { name: "description", label: "Description", required: true, wide: true, defaultValue: item?.description },
            { name: "vendor", label: "Paid to", required: true, defaultValue: item?.vendor, hint: "Vendor or person" },
            { name: "amount", label: "Amount (৳)", type: "number", required: true, defaultValue: item?.amount },
            { name: "category", label: "Category", type: "select", options: CATEGORIES.map((c) => ({ value: c, label: c })), defaultValue: item?.category },
            { name: "date", label: "Date", type: "date", required: true, defaultValue: item?.date ?? todayDhaka() },
            { name: "method", label: "Paid by", type: "select", options: PAYMENT_METHODS.filter((m) => m.key !== "SSLCOMMERZ").map((m) => ({ value: m.key, label: m.label })), defaultValue: item?.method ?? "BANK" },
            { name: "reference", label: "Cheque / transaction no.", defaultValue: item?.reference },
          ]}
          submitLabel={item ? "Save changes" : "Add expense"}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            const amount = Number(v.amount);
            if (!(amount > 0)) return "Enter an amount greater than zero.";
            if (v.date! > todayDhaka()) return "The date can't be in the future.";
            if (v.method !== "CASH" && !v.reference) return "Enter the cheque or transaction number for non-cash payments.";
            const values = { description: v.description!, vendor: v.vendor!, amount, category: v.category as ExpenseCategory, date: v.date!, method: v.method as PaymentMethod, reference: v.reference || null };
            let voucher = item?.voucherNo ?? "";
            update((d) => {
              if (item) Object.assign(d.expenses.find((e) => e.id === item.id)!, values);
              else {
                voucher = `VCH-${values.date.slice(0, 4)}-${String(nextCounter(d, "voucher")).padStart(4, "0")}`;
                d.expenses.push({ id: newId(), voucherNo: voucher, recordedBy: actor, ...values });
              }
            });
            toast(item ? "Expense updated" : `${taka(amount)} recorded · ${voucher}`);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}

// ── Payroll ──────────────────────────────────────────────────────────────

function Payroll({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const runs = [...db.payrollRuns].sort((a, b) => b.month.localeCompare(a.month));
  const nextMonth = (() => {
    const last = runs[0]?.month ?? todayDhaka().slice(0, 7);
    if (!runs.length) return last;
    const [y, m] = last.split("-").map(Number);
    return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
  })();
  const manage = can("finance.manage");
  const run = runs.find((r) => r.id === open);

  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">Each run snapshots the salary structure, so later raises don&apos;t change past payslips.</span>
        {manage && (
          <Button
            size="sm"
            icon="plus"
            className="ml-auto"
            disabled={!db.salaries.length}
            onClick={() => {
              const id = newId();
              update((d) => {
                d.payrollRuns.push({ id, month: nextMonth, status: "DRAFT", createdAt: nowIso(), paidAt: null, lines: d.salaries.map((s) => ({ person: s.person, ...payslip(s) })) });
              });
              toast(`Draft payroll for ${monthLabel(nextMonth)} created`);
              setOpen(id);
            }}
          >
            Run payroll for {monthLabel(nextMonth)}
          </Button>
        )}
      </Toolbar>
      <Table head={["Month", "People", "Gross", "Deductions", "Net paid", "Status", ""]} empty={!runs.length && <EmptyState icon="banknote" title="No payroll runs yet" />}>
        {runs.map((r) => {
          const gross = r.lines.reduce((s, l) => s + l.gross, 0);
          const net = r.lines.reduce((s, l) => s + l.net, 0);
          return (
            <Tr key={r.id}>
              <Td className="font-medium">{monthLabel(r.month)}</Td>
              <Td className="tabular-nums">{r.lines.length}</Td>
              <Td className="tabular-nums">{taka(gross)}</Td>
              <Td className="text-muted tabular-nums">{taka(gross - net)}</Td>
              <Td className="font-medium tabular-nums">{taka(net)}</Td>
              <Td>
                <Badge tone={r.status === "PAID" ? "success" : "warning"} dot>
                  {r.status === "PAID" ? `Paid ${formatDate(r.paidAt)}` : "Draft"}
                </Badge>
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setOpen(r.id)}>
                  Open
                </Button>
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!run} onClose={() => setOpen(null)} title={run ? `Payroll · ${monthLabel(run.month)}` : ""} size="xl">
        {run && <RunDetail db={db} run={run} onClose={() => setOpen(null)} />}
      </Modal>
    </Card>
  );
}

function RunDetail({ db, run, onClose }: { db: DemoDb; run: PayrollRun; onClose: () => void }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [slip, setSlip] = useState<PayrollLine | null>(null);
  const totals = run.lines.reduce((t, l) => ({ gross: t.gross + l.gross, pf: t.pf + l.providentFund, tax: t.tax + l.tax, net: t.net + l.net }), { gross: 0, pf: 0, tax: 0, net: 0 });

  if (slip) return <Payslip db={db} run={run} line={slip} onBack={() => setSlip(null)} />;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Gross", totals.gross],
          ["Provident fund", totals.pf],
          ["Income tax (TDS)", totals.tax],
          ["Net to bank", totals.net],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl border border-border px-4 py-3">
            <p className="text-xs text-subtle">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{taka(v as number)}</p>
          </div>
        ))}
      </div>
      <Table head={["Employee", "Gross", "PF", "Tax", "Net", ""]}>
        {run.lines.map((l) => (
          <Tr key={`${l.person.type}-${l.person.id}`}>
            <Td>
              <PersonCell db={db} refValue={l.person} />
            </Td>
            <Td className="tabular-nums">{taka(l.gross)}</Td>
            <Td className="text-muted tabular-nums">{taka(l.providentFund)}</Td>
            <Td className="text-muted tabular-nums">{taka(l.tax)}</Td>
            <Td className="font-medium tabular-nums">{taka(l.net)}</Td>
            <Td className="text-right">
              <Button size="sm" variant="ghost" icon="receipt" onClick={() => setSlip(l)}>
                Payslip
              </Button>
            </Td>
          </Tr>
        ))}
      </Table>
      <FormActions>
        {run.status === "DRAFT" && can("finance.manage") && (
          <Button
            variant="ghost"
            className="mr-auto text-danger"
            onClick={() => {
              update((d) => {
                d.payrollRuns = d.payrollRuns.filter((r) => r.id !== run.id);
              });
              toast("Draft discarded");
              onClose();
            }}
          >
            Discard draft
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(`payroll-${run.month}.csv`, [
              ["Name", "Type", "Bank account", "Gross", "Provident fund", "Tax", "Net"],
              ...run.lines.map((l) => [person(db, l.person).name, person(db, l.person).kind, db.salaries.find((s) => sameRef(s.person, l.person))?.bankAccount, l.gross, l.providentFund, l.tax, l.net]),
            ])
          }
        >
          Bank advice CSV
        </Button>
        {run.status === "DRAFT" && can("finance.manage") && (
          <Button
            icon="check"
            onClick={async () => {
              if (!(await confirmAction({ title: `Mark ${monthLabel(run.month)} salaries as paid?`, text: `${taka(totals.net)} to ${run.lines.length} people. Payslips will show this payment date.`, confirmText: "Mark as paid" }))) return;
              update((d) => {
                Object.assign(d.payrollRuns.find((r) => r.id === run.id)!, { status: "PAID", paidAt: nowIso() });
              });
              toast(`${monthLabel(run.month)} payroll marked as paid`);
            }}
          >
            Mark as paid
          </Button>
        )}
      </FormActions>
    </div>
  );
}

function Payslip({ db, run, line, onBack }: { db: DemoDb; run: PayrollRun; line: PayrollLine; onBack: () => void }) {
  const { tenant } = useAuth();
  const salary = db.salaries.find((s) => sameRef(s.person, line.person));
  const p = person(db, line.person);
  // Earnings come from the current structure only when it still matches the run's gross.
  const parts = salary && payslip(salary).gross === line.gross ? [["Basic", salary.basic], ["House rent", salary.houseRent], ["Medical", salary.medical], ["Conveyance", salary.conveyance]] : [["Gross salary", line.gross]];
  return (
    <div>
      <div className="print-area mx-auto max-w-xl space-y-4 rounded-xl border border-border p-6">
        <div className="flex justify-between border-b border-dashed border-border pb-3">
          <div>
            <p className="font-semibold">{tenant?.name}</p>
            <p className="text-xs text-muted">Payslip · {monthLabel(run.month)}</p>
          </div>
          <Badge tone={run.status === "PAID" ? "success" : "warning"}>{run.status === "PAID" ? "Paid" : "Draft"}</Badge>
        </div>
        <InfoGrid
          items={[
            ["Employee", p.name],
            ["Position", p.detail],
            ["Bank account", salary?.bankAccount],
            ["Paid on", run.paidAt ? formatDate(run.paidAt) : "Not yet paid"],
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td colSpan={2} className="pb-1 text-xs font-semibold text-subtle uppercase">
                  Earnings
                </td>
              </tr>
              {parts.map(([label, v]) => (
                <tr key={label as string}>
                  <td className="py-0.5 text-muted">{label}</td>
                  <td className="py-0.5 text-right tabular-nums">{taka(v as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td colSpan={2} className="pb-1 text-xs font-semibold text-subtle uppercase">
                  Deductions
                </td>
              </tr>
              <tr>
                <td className="py-0.5 text-muted">Provident fund ({PF_RATE * 100}% of basic)</td>
                <td className="py-0.5 text-right tabular-nums">{taka(line.providentFund)}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-muted">Income tax (TDS)</td>
                <td className="py-0.5 text-right tabular-nums">{taka(line.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between rounded-lg bg-success/10 px-4 py-3">
          <span className="text-sm font-medium">Net pay</span>
          <span className="text-lg font-semibold text-success tabular-nums">{taka(line.net)}</span>
        </div>
        <p className="text-[11px] text-subtle">Tax is an estimate from the general income tax slabs on 12 × gross, before exemptions and investment rebate.</p>
      </div>
      <FormActions>
        <Button variant="secondary" icon="arrowLeft" onClick={onBack}>
          Back
        </Button>
        <PrintButton label="Print payslip" />
      </FormActions>
    </div>
  );
}

// ── Salary structure ─────────────────────────────────────────────────────

function Salaries({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [editing, setEditing] = useState<{ person: PersonRef; salary: Salary | null } | null>(null);
  const people: PersonRef[] = [...db.teachers.map((t) => ({ type: "TEACHER" as const, id: t.id })), ...db.staff.filter((s) => s.status !== "RESIGNED").map((s) => ({ type: "STAFF" as const, id: s.id }))];
  const manage = can("finance.manage");
  const salaryOf = (p: PersonRef) => db.salaries.find((s) => sameRef(s.person, p));

  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">House rent is usually 50% of basic. PF is {PF_RATE * 100}% of basic.</span>
        <span className="ml-auto text-xs text-muted">{people.filter((p) => !salaryOf(p)).length} without a salary</span>
      </Toolbar>
      <Table head={["Employee", "Basic", "House rent", "Medical", "Conveyance", "Gross", "Net", ""]}>
        {people.map((p) => {
          const s = salaryOf(p);
          const slip = s ? payslip(s) : null;
          return (
            <Tr key={`${p.type}-${p.id}`}>
              <Td>
                <PersonCell db={db} refValue={p} />
              </Td>
              {s ? (
                <>
                  <Td className="tabular-nums">{taka(s.basic)}</Td>
                  <Td className="text-muted tabular-nums">{taka(s.houseRent)}</Td>
                  <Td className="text-muted tabular-nums">{taka(s.medical)}</Td>
                  <Td className="text-muted tabular-nums">{taka(s.conveyance)}</Td>
                  <Td className="font-medium tabular-nums">{taka(slip!.gross)}</Td>
                  <Td className="tabular-nums">{taka(slip!.net)}</Td>
                </>
              ) : (
                <td colSpan={6} className="px-5 py-3.5 text-sm text-warning">
                  No salary set, so they&apos;ll be left out of payroll runs
                </td>
              )}
              <Td className="text-right">
                {manage && (
                  <Button size="sm" variant={s ? "ghost" : "secondary"} onClick={() => setEditing({ person: p, salary: s ?? null })}>
                    {s ? "Edit" : "Set salary"}
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Salary" description={editing ? person(db, editing.person).name : undefined}>
        {editing && (
          <EntityForm
            fields={[
              { name: "basic", label: "Basic (৳)", type: "number", required: true, defaultValue: editing.salary?.basic },
              { name: "houseRent", label: "House rent (৳)", type: "number", defaultValue: editing.salary?.houseRent, hint: "Leave empty for 50% of basic" },
              { name: "medical", label: "Medical (৳)", type: "number", required: true, defaultValue: editing.salary?.medical ?? 5000 },
              { name: "conveyance", label: "Conveyance (৳)", type: "number", required: true, defaultValue: editing.salary?.conveyance ?? 3000 },
              { name: "bankAccount", label: "Bank account", required: true, wide: true, defaultValue: editing.salary?.bankAccount, hint: "Bank and account number for salary transfer" },
            ]}
            submitLabel="Save salary"
            onCancel={() => setEditing(null)}
            onSubmit={(v) => {
              const basic = Number(v.basic);
              const houseRent = v.houseRent ? Number(v.houseRent) : Math.round(basic * 0.5);
              const medical = Number(v.medical);
              const conveyance = Number(v.conveyance);
              if ([basic, houseRent, medical, conveyance].some((x) => !Number.isFinite(x) || x < 0) || basic <= 0) return "Amounts must be numbers, and basic must be above zero.";
              const values = { basic, houseRent, medical, conveyance, bankAccount: v.bankAccount! };
              update((d) => {
                const existing = d.salaries.find((s) => sameRef(s.person, editing.person));
                if (existing) Object.assign(existing, values);
                else d.salaries.push({ id: newId(), person: editing.person, ...values });
              });
              toast(`Salary saved · net ${taka(payslip({ id: "", person: editing.person, ...values }).net)} a month`);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
