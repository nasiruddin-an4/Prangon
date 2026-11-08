"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, nowIso } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { ClearanceOffice, ClearanceRequest, DemoDb } from "@/lib/demo/types";
import { CLEARANCE_OFFICES, clearanceChecks } from "@/lib/demo/workflows";
import { DemoLoading, DemoNotice, FilterSelect, Toolbar } from "@/components/demo";
import { Icon } from "@/components/icons";
import { Timeline } from "@/components/workflow-ui";
import { Badge, Button, Card, cx, EmptyState, Field, FormActions, formatDate, Modal, PageHeader, Select, StatCard, useToast } from "@/components/ui";

const REASON = { GRADUATION: "Graduation", WITHDRAWAL: "Withdrawal", TRANSFER: "Transfer" } as const;

export default function ClearancePage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [starting, setStarting] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Clearance"
        description="Graduation, withdrawal and transfer clearance. Each office signs off only when its own check passes; the Registrar gives the final approval. No paper running between offices."
        actions={
          <>
            <DemoNotice />
            {can("students.manage") && (
              <Button icon="plus" onClick={() => setStarting(true)}>
                Start clearance
              </Button>
            )}
          </>
        }
      />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="In progress" value={db.clearances.filter((c) => c.status === "IN_PROGRESS").length} icon="clock" />
            <StatCard label="Waiting for the Registrar" value={db.clearances.filter((c) => c.status === "IN_PROGRESS" && CLEARANCE_OFFICES.every((o) => c.signoffs[o.key])).length} icon="check" />
            <StatCard label="Approved" value={db.clearances.filter((c) => c.status === "APPROVED").length} icon="award" />
            <StatCard label="Rejected" value={db.clearances.filter((c) => c.status === "REJECTED").length} icon="x" />
          </div>
          <Requests db={db} />
          <Modal open={starting} onClose={() => setStarting(false)} title="Start clearance" description="Every office sees the request straight away.">
            {starting && <StartForm db={db} onDone={() => setStarting(false)} />}
          </Modal>
        </>
      )}
    </>
  );
}

function Requests({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const { update, actor } = useDemo();
  const toast = useToast();
  const [status, setStatus] = useState<ClearanceRequest["status"] | "">("IN_PROGRESS");
  const rows = db.clearances.filter((c) => !status || c.status === status).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const signOff = (c: ClearanceRequest, office: ClearanceOffice, label: string) => {
    update((d) => {
      const x = d.clearances.find((y) => y.id === c.id)!;
      x.signoffs[office] = { by: actor, at: nowIso() };
      x.history.push({ at: nowIso(), by: actor, text: `${label} cleared` });
    });
    toast(`${label} signed off`);
  };

  const decide = (c: ClearanceRequest, approve: boolean) => {
    const student = lookup(db.students, c.studentId);
    update((d) => {
      const x = d.clearances.find((y) => y.id === c.id)!;
      Object.assign(x, { status: approve ? "APPROVED" : "REJECTED", decidedBy: actor, decidedAt: nowIso() });
      x.history.push({ at: nowIso(), by: actor, text: approve ? "Final approval by the Registrar" : "Rejected by the Registrar" });
      // The Registrar owns the student's status, so only this final step changes it.
      if (approve) d.students.find((s) => s.id === c.studentId)!.status = c.reason === "GRADUATION" ? "GRADUATED" : "DROPPED";
    });
    toast(approve ? `${student?.name} cleared · status updated` : "Clearance rejected");
  };

  return (
    <div className="space-y-4">
      <Card>
        <Toolbar>
          <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as typeof status)}>
            <option value="">All</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </FilterSelect>
          <span className="ml-auto text-xs text-muted">You can sign off only for offices your role covers.</span>
        </Toolbar>
        {rows.length === 0 && <EmptyState icon="check" title="No clearance requests here" />}
      </Card>
      {rows.map((c) => {
        const s = lookup(db.students, c.studentId);
        const checks = clearanceChecks(db, c.studentId);
        const allSigned = CLEARANCE_OFFICES.every((o) => c.signoffs[o.key]);
        return (
          <Card
            key={c.id}
            title={
              <div>
                <h2 className="text-[15px] font-semibold">{s?.name}</h2>
                <p className="text-xs text-muted">
                  <span className="font-mono">{s?.studentId}</span> · {REASON[c.reason]} · started {formatDate(c.requestedAt)}
                </p>
              </div>
            }
            actions={<Badge tone={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "danger" : "warning"} dot>{c.status === "IN_PROGRESS" ? `${CLEARANCE_OFFICES.filter((o) => c.signoffs[o.key]).length} of ${CLEARANCE_OFFICES.length} offices` : c.status === "APPROVED" ? "Approved" : "Rejected"}</Badge>}
          >
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
              <ul className="divide-y divide-border rounded-xl border border-border">
                {CLEARANCE_OFFICES.map((o) => {
                  const signed = c.signoffs[o.key];
                  const check = checks[o.key];
                  return (
                    <li key={o.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                      <span className={cx("grid size-7 place-items-center rounded-full", signed ? "bg-success/15 text-success" : check.ok ? "bg-surface-3 text-muted" : "bg-danger/12 text-danger")}>
                        <Icon name={signed ? "check" : check.ok ? "clock" : "alert"} className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{o.label}</span>
                        <span className={cx("block text-xs", !signed && !check.ok ? "text-danger" : "text-muted")}>{signed ? `Signed by ${signed.by}, ${formatDate(signed.at)}` : check.detail}</span>
                      </span>
                      {!signed && c.status === "IN_PROGRESS" && can(o.permission) && (
                        <Button size="sm" variant="secondary" disabled={!check.ok} title={check.ok ? undefined : "The check must pass first"} onClick={() => signOff(c, o.key, o.label)}>
                          Sign off
                        </Button>
                      )}
                    </li>
                  );
                })}
                <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={cx("grid size-7 place-items-center rounded-full", c.status === "APPROVED" ? "bg-success/15 text-success" : "bg-surface-3 text-muted")}>
                    <Icon name={c.status === "APPROVED" ? "check" : "shield"} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Registrar</span>
                    <span className="block text-xs text-muted">{c.decidedBy ? `${c.status === "APPROVED" ? "Approved" : "Rejected"} by ${c.decidedBy}` : allSigned ? "Ready for final approval" : "After every office signs off"}</span>
                  </span>
                  {c.status === "IN_PROGRESS" && can("students.manage") && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => decide(c, false)}>
                        Reject
                      </Button>
                      <Button size="sm" disabled={!allSigned} onClick={() => decide(c, true)}>
                        Approve
                      </Button>
                    </>
                  )}
                </li>
              </ul>
              <Timeline events={c.history} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function StartForm({ db, onDone }: { db: DemoDb; onDone: () => void }) {
  const { update, actor } = useDemo();
  const toast = useToast();
  const busy = new Set(db.clearances.filter((c) => c.status === "IN_PROGRESS").map((c) => c.studentId));
  const candidates = db.students.filter((s) => s.status === "ACTIVE" && !busy.has(s.id)).sort((a, b) => a.studentId.localeCompare(b.studentId));
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<ClearanceRequest["reason"]>("GRADUATION");
  return (
    <div className="grid gap-4">
      <Field label="Student">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Choose…</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.studentId} · {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason">
        <Select value={reason} onChange={(e) => setReason(e.target.value as ClearanceRequest["reason"])}>
          {(Object.keys(REASON) as (keyof typeof REASON)[]).map((r) => (
            <option key={r} value={r}>
              {REASON[r]}
            </option>
          ))}
        </Select>
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!studentId}
          onClick={() => {
            update((d) => {
              d.clearances.push({ id: crypto.randomUUID(), studentId, reason, requestedAt: nowIso(), status: "IN_PROGRESS", signoffs: {}, decidedBy: null, decidedAt: null, history: [{ at: nowIso(), by: actor, text: `${REASON[reason]} clearance started` }] });
            });
            toast("Clearance started; every office can see it now");
            onDone();
          }}
        >
          Start
        </Button>
      </FormActions>
    </div>
  );
}
