"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { addDays, BORROW_LIMIT, copiesOut, downloadCsv, FINE_PER_DAY, fineFor, issueProblem, LOAN_DAYS, lookup, newId, person, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import { isPaid, raiseCharge } from "@/lib/demo/workflows";
import type { Book, BookIssue, DemoDb, PersonRef } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, FilterSelect, PersonCell, PersonPicker, Tabs, Toolbar } from "@/components/demo";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, SearchInput, Select, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

type Tab = "loans" | "catalogue" | "history";

export default function LibraryPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [tab, setTab] = useState<Tab>("loans");
  const [issuing, setIssuing] = useState(false);
  const manage = can("library.manage");
  return (
    <>
      <PageHeader
        eyebrow="Campus services"
        title="Library"
        description={`Catalogue, issues and returns. Loans run ${LOAN_DAYS} days; late returns are fined ৳${FINE_PER_DAY} a day. Students may borrow ${BORROW_LIMIT.STUDENT} books, teachers ${BORROW_LIMIT.TEACHER}.`}
        actions={
          <>
            <DemoNotice />
            {manage && (
              <Button icon="bookOpen" onClick={() => setIssuing(true)}>
                Issue a book
              </Button>
            )}
          </>
        }
      />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <Summary db={db} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "loans", label: "On loan", count: db.bookIssues.filter((i) => !i.returnedOn).length },
              { key: "catalogue", label: "Catalogue", count: db.books.length },
              { key: "history", label: "Returned", count: db.bookIssues.filter((i) => i.returnedOn).length },
            ]}
          />
          {tab === "loans" && <Loans db={db} />}
          {tab === "catalogue" && <Catalogue db={db} />}
          {tab === "history" && <History db={db} />}
          <Modal open={issuing} onClose={() => setIssuing(false)} title="Issue a book">
            {issuing && <IssueForm db={db} onDone={() => setIssuing(false)} />}
          </Modal>
        </>
      )}
    </>
  );
}

function Summary({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const open = db.bookIssues.filter((i) => !i.returnedOn);
  const overdue = open.filter((i) => i.dueOn < today);
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Titles" value={db.books.length} sub={`${db.books.reduce((s, b) => s + b.copies, 0)} copies`} icon="bookOpen" />
      <StatCard label="On loan" value={open.length} icon="clock" />
      <StatCard label="Overdue" value={overdue.length} sub={overdue.length ? `${taka(overdue.reduce((s, i) => s + fineFor(i, today), 0))} in fines` : undefined} icon="alert" />
      <StatCard label="Fines charged" value={taka(db.bookIssues.reduce((s, i) => s + (i.returnedOn ? i.fine : 0), 0))} sub={`${db.bookIssues.filter((i) => i.fineInvoiceId && !isPaid(db, i.fineInvoiceId)).length} unpaid at Accounts`} icon="wallet" />
    </div>
  );
}

function Loans({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const today = todayDhaka();
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [returning, setReturning] = useState<BookIssue | null>(null);
  const rows = db.bookIssues.filter((i) => !i.returnedOn && (!onlyOverdue || i.dueOn < today)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return (
    <Card>
      <Toolbar>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Only overdue
        </label>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(`library-loans-${today}.csv`, [
              ["Book", "Borrower", "Type", "Issued", "Due", "Fine so far"],
              ...rows.map((i) => [lookup(db.books, i.bookId)?.title, person(db, i.borrower).name, person(db, i.borrower).kind, i.issuedOn, i.dueOn, fineFor(i, today)]),
            ])
          }
        >
          Export CSV
        </Button>
      </Toolbar>
      <Table head={["Book", "Borrower", "Issued", "Due", "Fine", ""]} empty={!rows.length && <EmptyState icon="bookOpen" title={onlyOverdue ? "Nothing overdue" : "No books on loan"} />}>
        {rows.map((i) => {
          const book = lookup(db.books, i.bookId);
          const late = i.dueOn < today;
          return (
            <Tr key={i.id}>
              <Td>
                <p className="font-medium">{book?.title}</p>
                <p className="text-xs text-muted">{book?.author}</p>
              </Td>
              <Td>
                <PersonCell db={db} refValue={i.borrower} />
              </Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(i.issuedOn)}</Td>
              <Td className="whitespace-nowrap">{late ? <Badge tone="danger">Overdue · {formatDate(i.dueOn)}</Badge> : <span className="text-muted">{formatDate(i.dueOn)}</span>}</Td>
              <Td className={late ? "font-medium text-danger tabular-nums" : "text-subtle tabular-nums"}>{taka(fineFor(i, today))}</Td>
              <Td className="text-right whitespace-nowrap">
                {can("library.manage") && (
                  <>
                    {!late && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          update((d) => {
                            const x = d.bookIssues.find((y) => y.id === i.id)!;
                            x.dueOn = addDays(x.dueOn, LOAN_DAYS);
                          });
                          toast(`Renewed until ${formatDate(addDays(i.dueOn, LOAN_DAYS))}`);
                        }}
                      >
                        Renew
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setReturning(i)}>
                      Return
                    </Button>
                  </>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!returning} onClose={() => setReturning(null)} title="Return book">
        {returning && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-medium">{lookup(db.books, returning.bookId)?.title}</span> from <span className="font-medium">{person(db, returning.borrower).name}</span>
            </p>
            {fineFor(returning, today) > 0 ? (
              <p className="rounded-xl bg-danger/8 px-4 py-3 text-sm text-danger">
                Returned {Math.round(fineFor(returning, today) / FINE_PER_DAY)} days late: a fine of <span className="font-semibold">{taka(fineFor(returning, today))}</span>.{" "}
                {returning.borrower.type === "STUDENT" ? "It goes to Accounts as a charge on the student's account; they pay it with their fees or online." : "Collect it at the desk."}
              </p>
            ) : (
              <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">On time, no fine.</p>
            )}
            <FormActions>
              <Button variant="secondary" onClick={() => setReturning(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const fine = fineFor(returning, today);
                  const billed = fine > 0 && returning.borrower.type === "STUDENT";
                  let invoiceNo = "";
                  update((d) => {
                    const issue = d.bookIssues.find((y) => y.id === returning.id)!;
                    Object.assign(issue, { returnedOn: today, fine });
                    if (billed) {
                      // Library doesn't take the money: it raises a charge that Accounts collects.
                      const title = lookup(d.books, issue.bookId)?.title ?? "book";
                      const charge = raiseCharge(d, returning.borrower.id, "FINE", `Library fine · “${title}” returned ${Math.round(fine / FINE_PER_DAY)} days late`, fine, today);
                      issue.fineInvoiceId = charge.id;
                      invoiceNo = charge.invoiceNo;
                    }
                  });
                  toast(billed ? `Returned · ${taka(fine)} fine billed to Accounts (${invoiceNo})` : fine ? `Returned · fine ${taka(fine)} collected` : "Returned");
                  setReturning(null);
                }}
              >
                {!fineFor(returning, today) ? "Mark returned" : returning.borrower.type === "STUDENT" ? "Return & bill fine" : "Collect fine & return"}
              </Button>
            </FormActions>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Catalogue({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const categories = [...new Set(db.books.map((b) => b.category))].sort();
  const q = query.trim().toLowerCase();
  const rows = db.books.filter((b) => (!category || b.category === category) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.includes(q))).sort((a, b) => a.title.localeCompare(b.title));
  const item = editing === "new" ? null : editing;

  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Title, author or ISBN" />
        <FilterSelect label="Category" value={category} onChange={setCategory}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        {can("library.manage") && (
          <Button size="sm" icon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Add book
          </Button>
        )}
      </Toolbar>
      <Table head={["Title", "Category", "Shelf", "Available", ""]} empty={!rows.length && <EmptyState icon="bookOpen" title="No books match" />}>
        {rows.map((b) => {
          const out = copiesOut(db, b.id);
          return (
            <Tr key={b.id}>
              <Td>
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted">
                  {b.author} · {b.publisher} · <span className="font-mono">{b.isbn}</span>
                </p>
              </Td>
              <Td className="text-muted">{b.category}</Td>
              <Td className="font-mono text-xs">{b.shelf}</Td>
              <Td>{out >= b.copies ? <Badge tone="danger">All {b.copies} out</Badge> : <span className="tabular-nums">{b.copies - out} of {b.copies}</span>}</Td>
              <Td className="text-right">
                {can("library.manage") && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                    Edit
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={item ? "Edit book" : "Add book"}>
        <EntityForm
          fields={[
            { name: "title", label: "Title", required: true, wide: true, defaultValue: item?.title },
            { name: "author", label: "Author", required: true, wide: true, defaultValue: item?.author },
            { name: "isbn", label: "ISBN", required: true, defaultValue: item?.isbn },
            { name: "category", label: "Category", required: true, defaultValue: item?.category ?? category, hint: "e.g. Computer Science" },
            { name: "publisher", label: "Publisher", defaultValue: item?.publisher },
            { name: "shelf", label: "Shelf", required: true, defaultValue: item?.shelf, hint: "e.g. CS-A1" },
            { name: "copies", label: "Copies", type: "number", required: true, defaultValue: item?.copies ?? 1 },
          ]}
          submitLabel={item ? "Save changes" : "Add book"}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            const copies = Number(v.copies);
            if (!Number.isInteger(copies) || copies < 1) return "Copies must be a whole number, at least 1.";
            if (item && copies < copiesOut(db, item.id)) return `${copiesOut(db, item.id)} copies are on loan, so there can't be fewer than that.`;
            const isbn = v.isbn!.replace(/[\s-]/g, "");
            if (!/^\d{10}(\d{3})?$/.test(isbn)) return "ISBN must be 10 or 13 digits.";
            if (db.books.some((b) => b.isbn === isbn && b.id !== item?.id)) return "A book with this ISBN is already in the catalogue.";
            const values = { title: v.title!, author: v.author!, isbn, category: v.category!, publisher: v.publisher ?? "", shelf: v.shelf!.toUpperCase(), copies };
            update((d) => {
              if (item) Object.assign(d.books.find((b) => b.id === item.id)!, values);
              else d.books.push({ id: newId(), ...values });
            });
            toast(item ? "Book updated" : `“${values.title}” added`);
            setEditing(null);
          }}
        />
      </Modal>
    </Card>
  );
}

function History({ db }: { db: DemoDb }) {
  const rows = db.bookIssues.filter((i) => i.returnedOn).sort((a, b) => b.returnedOn!.localeCompare(a.returnedOn!));
  return (
    <Card>
      <Table head={["Book", "Borrower", "Issued", "Returned", "Fine"]} empty={!rows.length && <EmptyState icon="bookOpen" title="No returns yet" />}>
        {rows.map((i) => (
          <Tr key={i.id}>
            <Td className="font-medium">{lookup(db.books, i.bookId)?.title}</Td>
            <Td>
              <PersonCell db={db} refValue={i.borrower} />
            </Td>
            <Td className="whitespace-nowrap text-muted">{formatDate(i.issuedOn)}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDate(i.returnedOn)}</Td>
            <Td className="tabular-nums">
              {i.fine ? (
                <>
                  {taka(i.fine)}{" "}
                  {i.fineInvoiceId ? isPaid(db, i.fineInvoiceId) ? <Badge tone="success">Paid at Accounts</Badge> : <Badge tone="warning">Billed · unpaid</Badge> : <span className="text-xs text-muted">collected</span>}
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
    </Card>
  );
}

function IssueForm({ db, onDone }: { db: DemoDb; onDone: () => void }) {
  const { update, actor } = useDemo();
  const toast = useToast();
  const today = todayDhaka();
  const [borrower, setBorrower] = useState<PersonRef | null>(null);
  const [bookId, setBookId] = useState("");
  const [dueOn, setDueOn] = useState(addDays(today, LOAN_DAYS));
  const [error, setError] = useState<string | null>(null);
  const books = [...db.books].sort((a, b) => a.title.localeCompare(b.title));

  function submit() {
    if (!borrower) return setError("Choose the borrower.");
    const problem = issueProblem(db, bookId, borrower, today);
    if (problem) return setError(problem);
    if (dueOn <= today) return setError("The due date must be after today.");
    update((d) => {
      d.bookIssues.push({ id: newId(), bookId, borrower, issuedOn: today, dueOn, returnedOn: null, fine: 0, issuedBy: actor });
    });
    toast(`Issued to ${person(db, borrower).name}, due ${formatDate(dueOn)}`);
    onDone();
  }

  return (
    <div className="grid gap-4">
      <Field label="Borrower">
        <PersonPicker db={db} types={["STUDENT", "TEACHER", "STAFF"]} value={borrower} onChange={setBorrower} />
      </Field>
      {borrower && (
        <p className="-mt-2 text-xs text-muted">
          Has {db.bookIssues.filter((i) => !i.returnedOn && i.borrower.type === borrower.type && i.borrower.id === borrower.id).length} of {BORROW_LIMIT[borrower.type]} books
        </p>
      )}
      <Field label="Book">
        <Select value={bookId} onChange={(e) => setBookId(e.target.value)}>
          <option value="">Choose a book…</option>
          {books.map((b) => {
            const left = b.copies - copiesOut(db, b.id);
            return (
              <option key={b.id} value={b.id} disabled={left <= 0}>
                {b.title} — {left > 0 ? `${left} available` : "all out"}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field label="Due on" hint={`Default loan is ${LOAN_DAYS} days`}>
        <Input type="date" value={dueOn} min={addDays(today, 1)} onChange={(e) => setDueOn(e.target.value)} />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Issue book</Button>
      </FormActions>
    </div>
  );
}
