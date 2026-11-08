"use client";

import { useState } from "react";
import { LEAVE_LABEL, newId, nowIso, sameRef, todayDhaka, workingDays } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, LeaveType, Student } from "@/lib/demo/types";
import { Textarea } from "@/components/demo";
import { PortalPage } from "@/components/portal";
import { ProfileAttendance } from "@/components/students";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, Select, Table, Td, Tr, useToast } from "@/components/ui";

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" } as const;

export default function PortalAttendance() {
  const [applying, setApplying] = useState(false);
  return (
    <PortalPage
      title="Attendance & leave"
      description="Course-wise attendance this semester. You need 75% to sit the final exam. Apply for leave here when you're ill or away."
      actions={
        <Button icon="plus" onClick={() => setApplying(true)}>
          Apply for leave
        </Button>
      }
    >
      {({ db, student }) => (
        <>
          <Card className="mb-6">
            <div className="p-5">
              <ProfileAttendance db={db} student={student} />
            </div>
          </Card>
          <MyLeave db={db} student={student} />
          <Modal open={applying} onClose={() => setApplying(false)} title="Apply for leave" description="Your department office reviews it. Approved leave is noted against your attendance.">
            {applying && <LeaveForm db={db} student={student} onDone={() => setApplying(false)} />}
          </Modal>
        </>
      )}
    </PortalPage>
  );
}

function MyLeave({ db, student }: { db: DemoDb; student: Student }) {
  const rows = db.leaves.filter((l) => sameRef(l.person, { type: "STUDENT", id: student.id })).sort((a, b) => b.from.localeCompare(a.from));
  return (
    <Card title="My leave applications">
      <Table head={["Leave", "Dates", "Days", "Status", "Remark"]} empty={!rows.length && <EmptyState icon="umbrella" title="No leave applications" />}>
        {rows.map((l) => (
          <Tr key={l.id}>
            <Td>
              <p>{LEAVE_LABEL[l.type]}</p>
              <p className="max-w-64 truncate text-xs text-muted">{l.reason}</p>
            </Td>
            <Td className="whitespace-nowrap text-muted">{l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} – ${formatDate(l.to)}`}</Td>
            <Td className="tabular-nums">{l.days}</Td>
            <Td>
              <Badge tone={TONE[l.status]} dot>
                {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
              </Badge>
            </Td>
            <Td className="text-xs text-muted">{l.remark ?? "—"}</Td>
          </Tr>
        ))}
      </Table>
    </Card>
  );
}

function LeaveForm({ db, student, onDone }: { db: DemoDb; student: Student; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const today = todayDhaka();
  const [type, setType] = useState<LeaveType>("SICK");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const days = to >= from ? workingDays(from, to) : 0;
  const me = { type: "STUDENT" as const, id: student.id };

  function submit() {
    if (to < from) return setError("The leave can't end before it starts.");
    if (!days) return setError("Those dates are all Fridays.");
    if (reason.trim().length < 5) return setError("Give a reason.");
    const clash = db.leaves.find((l) => sameRef(l.person, me) && (l.status === "PENDING" || l.status === "APPROVED") && l.from <= to && from <= l.to);
    if (clash) return setError(`You already have a ${clash.status.toLowerCase()} application for ${formatDate(clash.from)}.`);
    update((d) => {
      d.leaves.push({ id: newId(), person: me, type, from, to, days, reason: reason.trim(), status: "PENDING", appliedAt: nowIso(), decidedAt: null, decidedBy: null, remark: null });
    });
    toast("Leave application sent");
    onDone();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Type" className="sm:col-span-2">
        <Select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
          <option value="SICK">{LEAVE_LABEL.SICK}</option>
          <option value="OTHER">{LEAVE_LABEL.OTHER} (family, travel…)</option>
        </Select>
      </Field>
      <Field label="From">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label="To">
        <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <p className="text-sm text-muted sm:col-span-2">
        {days} class day{days === 1 ? "" : "s"}
      </p>
      <Field label="Reason" className="sm:col-span-2">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever; I'll bring a medical certificate" />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Send application</Button>
      </FormActions>
    </div>
  );
}
