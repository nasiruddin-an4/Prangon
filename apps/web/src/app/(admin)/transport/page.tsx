"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { BD_PHONE, downloadCsv, lookup, newId, normalizePhone, routeLoad, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { BusRoute, DemoDb } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, Progress } from "@/components/demo";
import { Icon } from "@/components/icons";
import { Avatar, Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, Modal, PageHeader, Select, StatCard, useToast } from "@/components/ui";

export default function TransportPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [editing, setEditing] = useState<BusRoute | "new" | null>(null);
  const manage = can("students.manage");
  return (
    <>
      <PageHeader
        eyebrow="Campus services"
        title="Transport"
        description="University bus routes with stops, driver and capacity, and which students ride each one."
        actions={
          <>
            <DemoNotice />
            {manage && (
              <Button icon="plus" onClick={() => setEditing("new")}>
                Add route
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
            <StatCard label="Routes" value={db.routes.length} icon="bus" />
            <StatCard label="Riders" value={db.transport.length} icon="users" />
            <StatCard label="Free seats" value={db.routes.reduce((s, r) => s + Math.max(0, r.capacity - routeLoad(db, r.id)), 0)} icon="check" />
            <StatCard label="Monthly transport fees" value={taka(db.transport.reduce((s, t) => s + (lookup(db.routes, t.routeId)?.monthlyFee ?? 0), 0))} icon="wallet" />
          </div>
          {db.routes.length === 0 ? (
            <Card>
              <EmptyState icon="bus" title="No routes yet" action={manage && <Button icon="plus" onClick={() => setEditing("new")}>Add route</Button>} />
            </Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {db.routes.map((r) => (
                <RouteCard key={r.id} db={db} route={r} onEdit={manage ? () => setEditing(r) : undefined} />
              ))}
            </div>
          )}
          <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== "new" ? `Edit ${editing.code}` : "Add route"}>
            {editing !== null && <RouteForm db={db} route={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
          </Modal>
        </>
      )}
    </>
  );
}

function RouteCard({ db, route, onEdit }: { db: DemoDb; route: BusRoute; onEdit?: () => void }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);
  const riders = db.transport.filter((t) => t.routeId === route.id);
  const load = riders.length;
  const full = load >= route.capacity;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent">{route.code}</span>
          <div>
            <h2 className="text-[15px] font-semibold">{route.name}</h2>
            <p className="text-xs text-muted">
              {route.vehicleNo} · first pickup {route.departure} · {taka(route.monthlyFee)}/month
            </p>
          </div>
        </div>
      }
      actions={
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadCsv(`route-${route.code}-${todayDhaka()}.csv`, [
                ["Student ID", "Name", "Stop", "Mobile", "Guardian mobile"],
                ...riders.map((t) => {
                  const s = lookup(db.students, t.studentId);
                  return [s?.studentId, s?.name, t.stop, s?.phone, lookup(db.guardians, s?.guardianIds[0])?.phone];
                }),
              ])
            }
          >
            CSV
          </Button>
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs">
          {route.stops.map((stop, i) => (
            <li key={stop} className="flex items-center gap-1.5">
              <span className="rounded-full bg-surface-2 px-2.5 py-1">
                {stop} <span className="text-subtle">({riders.filter((t) => t.stop === stop).length})</span>
              </span>
              {i < route.stops.length - 1 && <Icon name="chevronRight" className="size-3 text-subtle" />}
            </li>
          ))}
        </ol>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">
              Driver {route.driverName} · <a href={`tel:${route.driverPhone}`} className="text-accent">{route.driverPhone}</a>
            </span>
            <span className={full ? "font-medium text-danger" : "text-muted"}>
              {load} / {route.capacity} seats{full && " · full"}
            </span>
          </div>
          <Progress value={(load / route.capacity) * 100} tone={full ? "danger" : load / route.capacity > 0.85 ? "warning" : "accent"} />
        </div>
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {riders.length === 0 && <li className="px-4 py-3 text-sm text-muted">No riders yet.</li>}
          {riders.map((t) => {
            const s = lookup(db.students, t.studentId);
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Avatar name={s?.name ?? "?"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s?.name}</span>
                  <span className="block font-mono text-xs text-muted">{s?.studentId}</span>
                </span>
                <Badge>{t.stop}</Badge>
                {can("students.manage") && (
                  <button
                    onClick={() => {
                      update((d) => {
                        d.transport = d.transport.filter((x) => x.id !== t.id);
                      });
                      toast(`${s?.name} removed from ${route.code}`);
                    }}
                    className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-danger"
                    aria-label={`Remove ${s?.name}`}
                  >
                    <Icon name="x" className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {can("students.manage") && (
          <Button size="sm" variant="secondary" icon="plus" disabled={full} title={full ? "The bus is full" : undefined} onClick={() => setAssigning(true)}>
            Add rider
          </Button>
        )}
      </div>
      <Modal open={assigning} onClose={() => setAssigning(false)} title={`Add rider · ${route.code} ${route.name}`}>
        {assigning && <AssignForm db={db} route={route} onDone={() => setAssigning(false)} />}
      </Modal>
    </Card>
  );
}

function AssignForm({ db, route, onDone }: { db: DemoDb; route: BusRoute; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [stop, setStop] = useState(route.stops[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const riding = new Set(db.transport.map((t) => t.studentId));
  const candidates = db.students.filter((s) => s.status === "ACTIVE" && !riding.has(s.id)).sort((a, b) => a.studentId.localeCompare(b.studentId));

  function submit() {
    if (!studentId) return setError("Choose a student.");
    if (routeLoad(db, route.id) >= route.capacity) return setError("The bus is full.");
    update((d) => {
      d.transport.push({ id: newId(), studentId, routeId: route.id, stop, since: todayDhaka() });
    });
    toast(`${lookup(db.students, studentId)?.name} added to ${route.code} at ${stop}`);
    onDone();
  }

  return (
    <div className="grid gap-4">
      <Field label="Student" hint="Students already on a route aren't listed; remove them from their route first">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Choose…</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.studentId} · {s.name} {s.district ? `(${s.district})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pickup stop">
        <Select value={stop} onChange={(e) => setStop(e.target.value)}>
          {route.stops.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Add rider</Button>
      </FormActions>
    </div>
  );
}

function RouteForm({ db, route, onDone }: { db: DemoDb; route: BusRoute | null; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  return (
    <EntityForm
      fields={[
        { name: "code", label: "Code", required: true, defaultValue: route?.code, hint: "e.g. R5" },
        { name: "name", label: "Name", required: true, defaultValue: route?.name, hint: "e.g. Gazipur – Campus" },
        { name: "stops", label: "Stops, in order", required: true, wide: true, defaultValue: route?.stops.join(", "), hint: "Comma-separated; end with Campus" },
        { name: "vehicleNo", label: "Vehicle registration", required: true, defaultValue: route?.vehicleNo, hint: "e.g. Dhaka Metro-Ba 11-2345" },
        { name: "departure", label: "First pickup", required: true, defaultValue: route?.departure ?? "07:00", hint: "24-hour, e.g. 07:10" },
        { name: "driverName", label: "Driver", required: true, defaultValue: route?.driverName },
        { name: "driverPhone", label: "Driver mobile", required: true, defaultValue: route?.driverPhone },
        { name: "capacity", label: "Seats", type: "number", required: true, defaultValue: route?.capacity ?? 40 },
        { name: "monthlyFee", label: "Monthly fee (৳)", type: "number", required: true, defaultValue: route?.monthlyFee ?? 2500 },
      ]}
      submitLabel={route ? "Save changes" : "Add route"}
      onCancel={onDone}
      onSubmit={(v) => {
        const stops = v.stops!.split(",").map((s) => s.trim()).filter(Boolean);
        const capacity = Number(v.capacity);
        const fee = Number(v.monthlyFee);
        const phone = normalizePhone(v.driverPhone!);
        if (stops.length < 2) return "A route needs at least two stops.";
        if (new Set(stops).size !== stops.length) return "Each stop should appear once.";
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.departure!)) return "First pickup must be a 24-hour time like 07:10.";
        if (!BD_PHONE.test(phone)) return "Driver mobile must be a Bangladeshi number.";
        if (!Number.isInteger(capacity) || capacity < 1) return "Seats must be a whole number.";
        if (route && capacity < routeLoad(db, route.id)) return `${routeLoad(db, route.id)} students ride this bus, so it needs at least that many seats.`;
        if (!(fee >= 0)) return "Enter the monthly fee.";
        if (db.routes.some((r) => r.code.toUpperCase() === v.code!.toUpperCase() && r.id !== route?.id)) return "Another route uses this code.";
        const removed = route ? route.stops.filter((s) => !stops.includes(s) && db.transport.some((t) => t.routeId === route.id && t.stop === s)) : [];
        if (removed.length) return `Students are picked up at ${removed.join(", ")}. Move them before removing the stop.`;
        const values = { code: v.code!.toUpperCase(), name: v.name!, stops, vehicleNo: v.vehicleNo!, departure: v.departure!, driverName: v.driverName!, driverPhone: phone, capacity, monthlyFee: fee };
        update((d) => {
          if (route) Object.assign(d.routes.find((r) => r.id === route.id)!, values);
          else d.routes.push({ id: newId(), ...values });
        });
        toast(route ? "Route updated" : `${values.code} added`);
        onDone();
      }}
    />
  );
}
