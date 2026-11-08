"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadCsv, LEAVE_LABEL, LEAVE_QUOTA, leaveUsed, newId, nowIso, onLeave, person, sameRef, todayDhaka, workingDays } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, LeaveRequest, LeaveStatus, LeaveType, PersonRef, PersonType } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, PersonCell, PersonPicker, Progress, Tabs, Textarea, Toolbar } from "@/components/demo";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, formatDate, Input, Modal, PageHeader, Select, StatCard, Table, Td, timeAgo, Tr, useToast } from "@/components/ui";

const STATUS: Record<LeaveStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
const STUDENT_TYPES: LeaveType[] = ["SICK", "OTHER"];
const EMPLOYEE_TYPES: LeaveType[] = ["CASUAL", "SICK", "EARNED", "MATERNITY", "OTHER"];

export default function LeavePage() {
  const { db } = useDemo();
  const [tab, setTab] = useState<"requests" | "balances">("requests");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Leave"
        description="Leave requests from students, teachers and staff. Employees have yearly quotas: casual 10, sick 14, earned 20 days. Fridays don't count."
        actions={
          <>
            <DemoNotice />
            <Button icon="plus" onClick={() => setCreating(true)}>
              New request
            </Button>
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
              { key: "requests", label: "Requests", count: db.leaves.length },
              { key: "balances", label: "Employee balances" },
            ]}
          />
          {tab === "requests" ? <Requests db={db} /> : <Balances db={db} />}
          <Modal open={creating} onClose={() => setCreating(false)} title="New leave request" size="lg">
            {creating && <RequestForm db={db} onDone={() => setCreating(false)} />}
          </Modal>
        </>
      )}
    </>
  );
}

function Summary({ db }: { db: DemoDb }) {
  const today = todayDhaka();
  const month = today.slice(0, 7);
  const away = db.leaves.filter((l) => l.status === "APPROVED" && l.from <= today && today <= l.to);
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Waiting for a decision" value={db.leaves.filter((l) => l.status === "PENDING").length} icon="clock" />
      <StatCard label="On leave today" value={away.length} sub={away.length ? away.map((l) => person(db, l.person).name.split(" ").slice(-1)[0]).slice(0, 2).join(", ") : undefined} icon="umbrella" />
      <StatCard label="Approved this month" value={db.leaves.filter((l) => l.status === "APPROVED" && l.from.startsWith(month)).length} icon="check" />
      <StatCard label="Days approved this year" value={db.leaves.filter((l) => l.status === "APPROVED" && l.from.startsWith(today.slice(0, 4))).reduce((s, l) => s + l.days, 0)} icon="calendar" />
    </div>
  );
}

function canDecide(can: (p: "students.manage" | "teachers.manage") => boolean, type: PersonType) {
  return type === "STUDENT" ? can("students.manage") : can("teachers.manage");
}

function Requests({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const [status, setStatus] = useState<LeaveStatus | "">("PENDING");
  const [who, setWho] = useState<PersonType | "">("");
  const [open, setOpen] = useState<LeaveRequest | null>(null);
  const rows = db.leaves
    .filter((l) => (!status || l.status === status) && (!who || l.person.type === who))
    .sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.from.localeCompare(a.from));

  return (
    <Card>
      <Toolbar>
        <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as LeaveStatus | "")}>
          <option value="">Any status</option>
          {(Object.keys(STATUS) as LeaveStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Who" value={who} onChange={(v) => setWho(v as PersonType | "")}>
          <option value="">Everyone</option>
          <option value="STUDENT">Students</option>
          <option value="TEACHER">Teachers</option>
          <option value="STAFF">Staff</option>
        </FilterSelect>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(`leave-${todayDhaka()}.csv`, [
              ["Name", "Type of person", "Leave type", "From", "To", "Days", "Status", "Reason", "Decided by"],
              ...rows.map((l) => [person(db, l.person).name, person(db, l.person).kind, LEAVE_LABEL[l.type], l.from, l.to, l.days, STATUS[l.status].label, l.reason, l.decidedBy]),
            ])
          }
        >
          Export CSV
        </Button>
      </Toolbar>
      <Table head={["Person", "Leave", "Dates", "Days", "Status", ""]} empty={!rows.length && <EmptyState icon="umbrella" title={status === "PENDING" ? "No requests waiting" : "No leave requests match"} />}>
        {rows.map((l) => (
          <Tr key={l.id}>
            <Td>
              <PersonCell db={db} refValue={l.person} />
            </Td>
            <Td>
              <p>{LEAVE_LABEL[l.type]}</p>
              <p className="max-w-56 truncate text-xs text-muted">{l.reason}</p>
            </Td>
            <Td className="whitespace-nowrap text-muted">{l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} – ${formatDate(l.to)}`}</Td>
            <Td className="tabular-nums">{l.days}</Td>
            <Td>
              <Badge tone={STATUS[l.status].tone} dot>
                {STATUS[l.status].label}
              </Badge>
            </Td>
            <Td className="text-right">
              <Button size="sm" variant={l.status === "PENDING" && canDecide(can, l.person.type) ? "secondary" : "ghost"} onClick={() => setOpen(l)}>
                {l.status === "PENDING" && canDecide(can, l.person.type) ? "Review" : "View"}
              </Button>
            </Td>
          </Tr>
        ))}
      </Table>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Leave request">
        {open && <Decision db={db} leave={db.leaves.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
      </Modal>
    </Card>
  );
}

function Decision({ db, leave, onClose }: { db: DemoDb; leave: LeaveRequest; onClose: () => void }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const [remark, setRemark] = useState(leave.remark ?? "");
  const [error, setError] = useState<string | null>(null);
  const year = leave.from.slice(0, 4);
  const quota = leave.person.type === "STUDENT" ? undefined : LEAVE_QUOTA[leave.type];
  const used = leaveUsed(db, leave.person, leave.type, year, leave.id);
  const decide = canDecide(can, leave.person.type);
  const today = todayDhaka();

  const set = (status: LeaveStatus, message: string) => {
    if (status === "APPROVED" && quota !== undefined && used + leave.days > quota) return setError(`This would use ${used + leave.days} of ${quota} ${LEAVE_LABEL[leave.type].toLowerCase()} leave days for ${year}.`);
    update((d) => {
      const x = d.leaves.find((y) => y.id === leave.id)!;
      Object.assign(x, { status, remark: remark.trim() || null, decidedAt: nowIso(), decidedBy: actor });
    });
    toast(message);
    onClose();
  };

  return (
    <div className="space-y-4">
      <PersonCell db={db} refValue={leave.person} />
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
        <div>
          <dt className="text-xs text-subtle">Leave</dt>
          <dd>{LEAVE_LABEL[leave.type]}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Working days</dt>
          <dd className="tabular-nums">{leave.days}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">From</dt>
          <dd>{formatDate(leave.from)}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">To</dt>
          <dd>{formatDate(leave.to)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-subtle">Reason</dt>
          <dd>{leave.reason}</dd>
        </div>
        <div className="col-span-2 text-xs text-muted">
          Applied {timeAgo(leave.appliedAt)}
          {leave.decidedBy && ` · ${STATUS[leave.status].label.toLowerCase()} by ${leave.decidedBy}`}
        </div>
      </dl>
      {quota !== undefined && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              {LEAVE_LABEL[leave.type]} leave used in {year} (before this request)
            </span>
            <span className="tabular-nums">
              {used} / {quota} days
            </span>
          </div>
          <Progress value={(used / quota) * 100} tone={used + leave.days > quota ? "danger" : "accent"} />
        </div>
      )}
      {leave.status === "PENDING" && decide ? (
        <Field label="Remark" hint="Optional; shown to the applicant">
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="min-h-16" />
        </Field>
      ) : (
        leave.remark && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{leave.remark}</p>
      )}
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {decide && (leave.status === "PENDING" || (leave.status === "APPROVED" && leave.from > today)) && (
          <Button variant="ghost" onClick={() => set("CANCELLED", "Leave cancelled")}>
            Cancel leave
          </Button>
        )}
        {decide && leave.status === "PENDING" && (
          <>
            <Button variant="danger" onClick={() => set("REJECTED", "Leave rejected")}>
              Reject
            </Button>
            <Button onClick={() => set("APPROVED", "Leave approved")}>Approve</Button>
          </>
        )}
      </FormActions>
    </div>
  );
}

function RequestForm({ db, onDone }: { db: DemoDb; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const today = todayDhaka();
  const [who, setWho] = useState<PersonRef | null>(null);
  const [type, setType] = useState<LeaveType>("SICK");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const types = who?.type === "STUDENT" ? STUDENT_TYPES : EMPLOYEE_TYPES;
  const days = to >= from ? workingDays(from, to) : 0;
  const quota = who && who.type !== "STUDENT" ? LEAVE_QUOTA[type] : undefined;
  const used = who ? leaveUsed(db, who, type, from.slice(0, 4)) : 0;

  function submit() {
    if (!who) return setError("Choose who the leave is for.");
    if (to < from) return setError("The leave can't end before it starts.");
    if (days === 0) return setError("Those dates are all Fridays.");
    if (reason.trim().length < 5) return setError("Give a reason.");
    const clash = db.leaves.find((l) => sameRef(l.person, who) && (l.status === "PENDING" || l.status === "APPROVED") && l.from <= to && from <= l.to);
    if (clash) return setError(`Overlaps an existing ${STATUS[clash.status].label.toLowerCase()} request (${formatDate(clash.from)} – ${formatDate(clash.to)}).`);
    update((d) => {
      d.leaves.push({ id: newId(), person: who, type, from, to, days, reason: reason.trim(), status: "PENDING", appliedAt: nowIso(), decidedAt: null, decidedBy: null, remark: null });
    });
    toast(`Leave request for ${person(db, who).name} submitted`);
    onDone();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Who" className="sm:col-span-2">
        <PersonPicker
          db={db}
          types={["TEACHER", "STAFF", "STUDENT"]}
          value={who}
          onChange={(v) => {
            setWho(v);
            if (v?.type === "STUDENT" && !STUDENT_TYPES.includes(type)) setType("SICK");
          }}
        />
      </Field>
      <Field label="Leave type">
        <Select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {LEAVE_LABEL[t]}
              {who && who.type !== "STUDENT" && LEAVE_QUOTA[t] ? ` (${LEAVE_QUOTA[t]} days a year)` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <p className="text-sm sm:col-span-2">
        <span className="font-semibold tabular-nums">{days}</span> working day{days === 1 ? "" : "s"}
        {quota !== undefined && (
          <span className={used + days > quota ? "text-danger" : "text-muted"}>
            {" "}
            · {used} of {quota} {LEAVE_LABEL[type].toLowerCase()} days already used this year
          </span>
        )}
      </p>
      <Field label="Reason" className="sm:col-span-2">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever; medical certificate attached" />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Submit request</Button>
      </FormActions>
    </div>
  );
}

function Balances({ db }: { db: DemoDb }) {
  const year = todayDhaka().slice(0, 4);
  const today = todayDhaka();
  const people: PersonRef[] = [...db.teachers.map((t) => ({ type: "TEACHER" as const, id: t.id })), ...db.staff.filter((s) => s.status !== "RESIGNED").map((s) => ({ type: "STAFF" as const, id: s.id }))];
  const kinds: LeaveType[] = ["CASUAL", "SICK", "EARNED"];
  return (
    <Card title={`Leave balances for ${year}`} description="Approved days used against each yearly quota">
      <Table head={["Person", ...kinds.map((k) => `${LEAVE_LABEL[k]} (${LEAVE_QUOTA[k]})`), "Today"]}>
        {people.map((p) => (
          <Tr key={`${p.type}-${p.id}`}>
            <Td>
              <PersonCell db={db} refValue={p} />
            </Td>
            {kinds.map((k) => {
              const used = leaveUsed(db, p, k, year);
              const quota = LEAVE_QUOTA[k]!;
              return (
                <Td key={k} className="min-w-32">
                  <div className="mb-1 text-xs tabular-nums">
                    <span className="font-medium">{quota - used}</span> <span className="text-muted">left · {used} used</span>
                  </div>
                  <Progress value={(used / quota) * 100} />
                </Td>
              );
            })}
            <Td>{onLeave(db, p, today) ? <Badge tone="warning">On leave</Badge> : <span className="text-xs text-subtle">At work</span>}</Td>
          </Tr>
        ))}
      </Table>
    </Card>
  );
}
