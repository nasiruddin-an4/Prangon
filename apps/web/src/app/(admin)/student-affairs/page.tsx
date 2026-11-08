"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, nowIso } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Ticket, TicketStatus } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, Tabs, Textarea, Toolbar } from "@/components/demo";
import { Icon } from "@/components/icons";
import { TICKET_CATEGORIES, TICKET_TONE, Timeline } from "@/components/workflow-ui";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, Input, Modal, PageHeader, StatCard, Table, Td, timeAgo, Tr, useToast } from "@/components/ui";

const STATUSES: TicketStatus[] = ["SUBMITTED", "ASSIGNED", "UNDER_REVIEW", "RESOLVED", "CLOSED"];
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");
/** The step each status moves to next. */
const NEXT: Partial<Record<TicketStatus, { to: TicketStatus; action: string }>> = {
  ASSIGNED: { to: "UNDER_REVIEW", action: "Start review" },
  UNDER_REVIEW: { to: "RESOLVED", action: "Mark resolved" },
  RESOLVED: { to: "CLOSED", action: "Close" },
};
const ASSIGNEES = ["Students' Affairs", "Registrar's Office", "Accounts", "Proctor Office", "Counselling Centre", "Hostel Office", "Transport Office", "Abul Kalam"];

export default function StudentAffairsPage() {
  const { db } = useDemo();
  const [status, setStatus] = useState<TicketStatus | "OPEN">("OPEN");
  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Student affairs"
        description="Complaints, counselling and record-correction requests from the student portal. Each ticket is assigned to an office and tracked to closure."
        actions={<DemoNotice />}
      />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="New" value={db.tickets.filter((t) => t.status === "SUBMITTED").length} sub="not yet assigned" icon="clock" />
            <StatCard label="Open" value={db.tickets.filter((t) => t.status === "ASSIGNED" || t.status === "UNDER_REVIEW").length} icon="megaphone" />
            <StatCard label="Confidential" value={db.tickets.filter((t) => t.confidential && t.status !== "CLOSED").length} icon="lock" />
            <StatCard label="Resolved" value={db.tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length} icon="check" />
          </div>
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[{ key: "OPEN" as const, label: "Open", count: db.tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED").length }, ...STATUSES.map((s) => ({ key: s, label: label(s), count: db.tickets.filter((t) => t.status === s).length }))]}
          />
          <Queue db={db} status={status} />
        </>
      )}
    </>
  );
}

function Queue({ db, status }: { db: DemoDb; status: TicketStatus | "OPEN" }) {
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = db.tickets
    .filter((t) => (status === "OPEN" ? t.status !== "RESOLVED" && t.status !== "CLOSED" : t.status === status) && (!category || t.category === category))
    .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt));
  const ticket = db.tickets.find((t) => t.id === open);
  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Category" value={category} onChange={setCategory}>
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{rows.length} tickets</span>
      </Toolbar>
      <Table head={["Ticket", "Student", "Category", "With", "Status", ""]} empty={!rows.length && <EmptyState icon="check" title="Nothing here" />}>
        {rows.map((t) => {
          const s = lookup(db.students, t.studentId);
          return (
            <Tr key={t.id}>
              <Td>
                <p className="flex items-center gap-1.5 font-medium">
                  {t.confidential && <Icon name="lock" className="size-3.5 text-warning" />}
                  {t.subject}
                </p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{t.ticketNo}</span> · {timeAgo(t.createdAt)}
                </p>
              </Td>
              <Td>
                <p>{s?.name}</p>
                <p className="font-mono text-xs text-muted">{s?.studentId}</p>
              </Td>
              <Td className="text-muted">{t.category}</Td>
              <Td className="text-muted">{t.assignee ?? "—"}</Td>
              <Td>
                <Badge tone={TICKET_TONE[t.status]} dot>
                  {label(t.status)}
                </Badge>
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setOpen(t.id)}>
                  Open
                </Button>
              </Td>
            </Tr>
          );
        })}
      </Table>
      <Modal open={!!ticket} onClose={() => setOpen(null)} title={ticket?.subject ?? ""} description={ticket ? `${ticket.ticketNo} · ${ticket.category}` : undefined} size="lg">
        {ticket && <TicketDetail db={db} ticket={ticket} onClose={() => setOpen(null)} />}
      </Modal>
    </Card>
  );
}

function TicketDetail({ db, ticket, onClose }: { db: DemoDb; ticket: Ticket; onClose: () => void }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const [assignee, setAssignee] = useState(ticket.assignee ?? ASSIGNEES[0]!);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const manage = can("students.manage");
  const student = lookup(db.students, ticket.studentId);
  // Confidential details are for staff who manage students (Student Affairs heads, Proctor), not every viewer.
  const hidden = ticket.confidential && !manage;
  const next = NEXT[ticket.status];

  const act = (patch: Partial<Ticket>, text: string, message: string) => {
    update((d) => {
      const x = d.tickets.find((y) => y.id === ticket.id)!;
      Object.assign(x, patch);
      x.history.push({ at: nowIso(), by: actor, text });
    });
    toast(message);
    setNote("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={TICKET_TONE[ticket.status]} dot>
          {label(ticket.status)}
        </Badge>
        {ticket.confidential && <Badge tone="warning">Confidential</Badge>}
        <span className="text-muted">
          From {student?.name} (<span className="font-mono">{student?.studentId}</span>)
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm whitespace-pre-line">{hidden ? "Details are confidential." : ticket.body}</p>
          {manage && ticket.status !== "CLOSED" && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Assign to">
                  <Input list="assignees" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!assignee.trim()) return setError("Enter who handles it.");
                    act({ assignee: assignee.trim(), status: ticket.status === "SUBMITTED" ? "ASSIGNED" : ticket.status }, `Assigned to ${assignee.trim()}`, `Assigned to ${assignee.trim()}`);
                  }}
                >
                  {ticket.assignee ? "Reassign" : "Assign"}
                </Button>
              </div>
              <datalist id="assignees">
                {ASSIGNEES.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <Field label="Update for the student" hint="Shown in their portal">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
              </Field>
              <ErrorNote message={error} />
            </div>
          )}
        </div>
        <Timeline events={ticket.history} />
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {manage && note.trim() && (
          <Button variant="secondary" onClick={() => act({}, note.trim(), "Update posted")}>
            Post update
          </Button>
        )}
        {manage && next && (
          <Button onClick={() => act({ status: next.to }, note.trim() || `${label(next.to)}`, `${ticket.ticketNo}: ${label(next.to).toLowerCase()}`)}>{next.action}</Button>
        )}
      </FormActions>
    </div>
  );
}
