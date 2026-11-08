"use client";

import { useState } from "react";
import { BORROW_LIMIT, copiesOut, fineFor, FINE_PER_DAY, LOAN_DAYS, lookup, taka, todayDhaka } from "@/lib/demo/logic";
import type { DemoDb, Student } from "@/lib/demo/types";
import { isPaid } from "@/lib/demo/workflows";
import { PortalPage } from "@/components/portal";
import { Badge, Card, EmptyState, formatDate, SearchInput, StatCard, Table, Td, Tr } from "@/components/ui";

export default function PortalLibrary() {
  return (
    <PortalPage title="Library" description={`Books you've borrowed and their return dates. Loans run ${LOAN_DAYS} days; late returns cost ৳${FINE_PER_DAY} a day, billed to your account.`}>
      {({ db, student }) => <Library db={db} student={student} />}
    </PortalPage>
  );
}

function Library({ db, student }: { db: DemoDb; student: Student }) {
  const today = todayDhaka();
  const [query, setQuery] = useState("");
  const mine = db.bookIssues.filter((i) => i.borrower.type === "STUDENT" && i.borrower.id === student.id);
  const open = mine.filter((i) => !i.returnedOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const history = mine.filter((i) => i.returnedOn).sort((a, b) => b.returnedOn!.localeCompare(a.returnedOn!));
  const q = query.trim().toLowerCase();
  const catalogue = q.length < 2 ? [] : db.books.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Borrowed now" value={open.length} sub={`of ${BORROW_LIMIT.STUDENT}`} icon="bookOpen" />
        <StatCard label="Overdue" value={open.filter((i) => i.dueOn < today).length} icon="alert" />
        <StatCard label="Fines so far" value={taka(open.reduce((s, i) => s + fineFor(i, today), 0))} sub="on open loans" icon="wallet" />
        <StatCard label="Returned" value={history.length} icon="check" />
      </div>
      <Card title="Borrowed books">
        <Table head={["Book", "Borrowed", "Return by", "Fine so far"]} empty={!open.length && <EmptyState icon="bookOpen" title="No books borrowed" />}>
          {open.map((i) => {
            const late = i.dueOn < today;
            return (
              <Tr key={i.id}>
                <Td>
                  <p className="font-medium">{lookup(db.books, i.bookId)?.title}</p>
                  <p className="text-xs text-muted">{lookup(db.books, i.bookId)?.author}</p>
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(i.issuedOn)}</Td>
                <Td className="whitespace-nowrap">{late ? <Badge tone="danger">Overdue · {formatDate(i.dueOn)}</Badge> : formatDate(i.dueOn)}</Td>
                <Td className={late ? "font-medium text-danger tabular-nums" : "text-subtle tabular-nums"}>{taka(fineFor(i, today))}</Td>
              </Tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Find a book" description="Check availability before you go to the library">
        <div className="border-b border-border px-5 py-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Title or author" />
        </div>
        {catalogue.length > 0 ? (
          <ul className="divide-y divide-border">
            {catalogue.map((b) => {
              const left = b.copies - copiesOut(db, b.id);
              return (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.title}</span>
                    <span className="block text-xs text-muted">
                      {b.author} · shelf {b.shelf}
                    </span>
                  </span>
                  {left > 0 ? <Badge tone="success">{left} available</Badge> : <Badge tone="danger">All out</Badge>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">{q.length < 2 ? "Type at least two letters." : "No books match."}</p>
        )}
      </Card>
      <Card title="History">
        <Table head={["Book", "Returned", "Fine"]} empty={!history.length && <EmptyState icon="bookOpen" title="Nothing returned yet" />}>
          {history.map((i) => (
            <Tr key={i.id}>
              <Td className="font-medium">{lookup(db.books, i.bookId)?.title}</Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(i.returnedOn)}</Td>
              <Td>
                {i.fine ? (
                  <span className="tabular-nums">
                    {taka(i.fine)}{" "}
                    {i.fineInvoiceId && (isPaid(db, i.fineInvoiceId) ? <Badge tone="success">Paid</Badge> : <Badge tone="danger">Unpaid · see Fees</Badge>)}
                  </span>
                ) : (
                  <span className="text-subtle">—</span>
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
