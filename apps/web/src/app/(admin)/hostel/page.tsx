"use client";

import { confirmAction } from "@/lib/alerts";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { activeAllocation, downloadCsv, lookup, newId, roomLoad, taka, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Hostel, HostelRoom } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, EntityForm, Tabs } from "@/components/demo";
import { Avatar, Button, Card, cx, ErrorNote, Field, FormActions, Modal, PageHeader, Select, StatCard, useToast } from "@/components/ui";

export default function HostelPage() {
  const { db } = useDemo();
  const [hostelId, setHostelId] = useState<string>("");
  return (
    <>
      <PageHeader eyebrow="Campus services" title="Hostel" description="Halls of residence: rooms, beds, who lives where, and seat allocation. Students are placed only in a hall for their gender." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : db.hostels.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-muted">No halls yet.</p>
        </Card>
      ) : (
        <>
          <Summary db={db} />
          <Tabs value={hostelId || db.hostels[0]!.id} onChange={setHostelId} tabs={db.hostels.map((h) => ({ key: h.id, label: h.name, count: db.allocations.filter((a) => !a.to && lookup(db.rooms, a.roomId)?.hostelId === h.id).length }))} />
          <HallView db={db} hostel={lookup(db.hostels, hostelId) ?? db.hostels[0]!} />
        </>
      )}
    </>
  );
}

function Summary({ db }: { db: DemoDb }) {
  const beds = db.rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = db.allocations.filter((a) => !a.to);
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Beds" value={beds} sub={`in ${db.rooms.length} rooms`} icon="bed" />
      <StatCard label="Residents" value={occupied.length} icon="users" />
      <StatCard label="Occupancy" value={`${beds ? Math.round((occupied.length / beds) * 100) : 0}%`} icon="chart" />
      <StatCard label="Monthly rent" value={taka(occupied.reduce((s, a) => s + (lookup(db.rooms, a.roomId)?.monthlyRent ?? 0), 0))} icon="wallet" />
    </div>
  );
}

function HallView({ db, hostel }: { db: DemoDb; hostel: Hostel }) {
  const { can } = useAuth();
  const { update } = useDemo();
  const toast = useToast();
  const [allocating, setAllocating] = useState<HostelRoom | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const manage = can("students.manage");
  const rooms = db.rooms.filter((r) => r.hostelId === hostel.id).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();

  return (
    <Card
      title={hostel.name}
      description={`Warden ${hostel.warden} · ${hostel.wardenPhone}`}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              downloadCsv(`hostel-${hostel.name.replace(/\W+/g, "-").toLowerCase()}-${todayDhaka()}.csv`, [
                ["Room", "Student ID", "Name", "Mobile", "Guardian mobile", "Since"],
                ...db.allocations
                  .filter((a) => !a.to && rooms.some((r) => r.id === a.roomId))
                  .map((a) => {
                    const s = lookup(db.students, a.studentId);
                    return [lookup(db.rooms, a.roomId)?.number, s?.studentId, s?.name, s?.phone, lookup(db.guardians, s?.guardianIds[0])?.phone, a.from];
                  }),
              ])
            }
          >
            Residents CSV
          </Button>
          {manage && (
            <Button size="sm" icon="plus" onClick={() => setAddingRoom(true)}>
              Add room
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6 p-5">
        {floors.map((floor) => (
          <section key={floor}>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-subtle uppercase">Floor {floor}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {rooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const residents = db.allocations.filter((a) => a.roomId === room.id && !a.to);
                  const free = room.capacity - residents.length;
                  return (
                    <div key={room.id} className={cx("rounded-xl border p-3", free === 0 ? "border-border bg-surface-2/50" : "border-border")}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-semibold">Room {room.number}</p>
                        <span className="text-xs text-muted">{taka(room.monthlyRent)}/mo</span>
                      </div>
                      <div className="mb-2 flex gap-1" aria-label={`${residents.length} of ${room.capacity} beds taken`}>
                        {Array.from({ length: room.capacity }, (_, i) => (
                          <span key={i} className={cx("h-1.5 flex-1 rounded-full", i < residents.length ? "bg-accent" : "bg-surface-3")} />
                        ))}
                      </div>
                      <ul className="space-y-1.5">
                        {residents.map((a) => {
                          const s = lookup(db.students, a.studentId);
                          return (
                            <li key={a.id} className="group flex items-center gap-2 text-xs">
                              <Avatar name={s?.name ?? "?"} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{s?.name}</span>
                                <span className="block font-mono text-[11px] text-muted">{s?.studentId}</span>
                              </span>
                              {manage && (
                                <button
                                  onClick={async () => {
                                    if (!(await confirmAction({ title: `Vacate ${s?.name}?`, text: `Their bed in room ${room.number} is freed from today.`, confirmText: "Vacate", danger: true }))) return;
                                    update((d) => {
                                      d.allocations.find((x) => x.id === a.id)!.to = todayDhaka();
                                    });
                                    toast(`${s?.name} vacated room ${room.number}`);
                                  }}
                                  className="rounded px-1.5 py-0.5 text-[11px] text-subtle hover:bg-surface-2 hover:text-danger"
                                >
                                  Vacate
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {free > 0 ? (
                        manage ? (
                          <button onClick={() => setAllocating(room)} className="mt-2 w-full rounded-lg border border-dashed border-border-strong py-1.5 text-xs text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent">
                            + Allocate ({free} free)
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-muted">{free} free</p>
                        )
                      ) : (
                        <p className="mt-2 text-xs font-medium text-muted">Full</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      <Modal open={!!allocating} onClose={() => setAllocating(null)} title={allocating ? `Allocate a bed · Room ${allocating.number}` : ""}>
        {allocating && <AllocateForm db={db} hostel={hostel} room={allocating} onDone={() => setAllocating(null)} />}
      </Modal>
      <Modal open={addingRoom} onClose={() => setAddingRoom(false)} title={`Add room · ${hostel.name}`}>
        {addingRoom && (
          <EntityForm
            fields={[
              { name: "number", label: "Room number", required: true },
              { name: "floor", label: "Floor", type: "number", required: true, defaultValue: 1 },
              { name: "capacity", label: "Beds", type: "number", required: true, defaultValue: 4 },
              { name: "monthlyRent", label: "Monthly rent per bed (৳)", type: "number", required: true, defaultValue: 3500 },
            ]}
            submitLabel="Add room"
            onCancel={() => setAddingRoom(false)}
            onSubmit={(v) => {
              const capacity = Number(v.capacity);
              const floor = Number(v.floor);
              const rent = Number(v.monthlyRent);
              if (!Number.isInteger(capacity) || capacity < 1 || capacity > 12) return "Beds must be a whole number from 1 to 12.";
              if (!Number.isInteger(floor) || floor < 0) return "Floor must be a whole number.";
              if (!(rent >= 0)) return "Enter the rent.";
              if (rooms.some((r) => r.number === v.number)) return `Room ${v.number} already exists in this hall.`;
              update((d) => {
                d.rooms.push({ id: newId(), hostelId: hostel.id, number: v.number!, floor, capacity, monthlyRent: rent });
              });
              toast(`Room ${v.number} added`);
              setAddingRoom(false);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}

function AllocateForm({ db, hostel, room, onDone }: { db: DemoDb; hostel: Hostel; room: HostelRoom; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const candidates = db.students.filter((s) => s.status === "ACTIVE" && s.gender === hostel.gender && !activeAllocation(db, s.id)).sort((a, b) => a.studentId.localeCompare(b.studentId));

  function submit() {
    const s = lookup(db.students, studentId);
    if (!s) return setError("Choose a student.");
    if (s.gender !== hostel.gender) return setError(`${hostel.name} is for ${hostel.gender.toLowerCase()} students.`);
    if (activeAllocation(db, s.id)) return setError(`${s.name} already has a bed. Vacate it first.`);
    if (roomLoad(db, room.id) >= room.capacity) return setError("This room is full.");
    update((d) => {
      d.allocations.push({ id: newId(), studentId: s.id, roomId: room.id, from: todayDhaka(), to: null });
    });
    toast(`${s.name} allocated to room ${room.number}`);
    onDone();
  }

  return (
    <div className="grid gap-4">
      <Field label="Student" hint={`${hostel.gender === "MALE" ? "Male" : "Female"} students without a bed`}>
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Choose…</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.studentId} · {s.name} {s.district ? `(${s.district})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-muted">
        Rent {taka(room.monthlyRent)} a month · {room.capacity - roomLoad(db, room.id)} bed{room.capacity - roomLoad(db, room.id) === 1 ? "" : "s"} free
      </p>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>Allocate bed</Button>
      </FormActions>
    </div>
  );
}
