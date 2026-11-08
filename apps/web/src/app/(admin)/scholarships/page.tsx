"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, newId, taka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Scholarship } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, Toolbar } from "@/components/demo";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, Input, Modal, PageHeader, SearchInput, StatCard, Table, Td, Tr, useToast } from "@/components/ui";

/** Tuition waived so far by a scholarship, from the invoices it discounted. */
const waivedBy = (db: DemoDb, s: Scholarship) => db.invoices.filter((i) => i.discountLabel?.startsWith(s.name)).reduce((sum, i) => sum + i.discount, 0);

export default function ScholarshipsPage() {
  const { db } = useDemo();
  return (
    <>
      <PageHeader eyebrow="Finance" title="Scholarships & waivers" description="Tuition waivers by percentage. They're applied when semester invoices are generated; one scholarship per student." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Scholarships" value={db.scholarships.length} icon="graduation" />
            <StatCard label="Students covered" value={new Set(db.scholarships.flatMap((s) => s.studentIds)).size} icon="users" />
            <StatCard label="Tuition waived" value={taka(db.invoices.reduce((s, i) => s + i.discount, 0))} icon="wallet" />
            <StatCard label="Average waiver" value={db.scholarships.length ? `${Math.round(db.scholarships.reduce((s, x) => s + x.percent, 0) / db.scholarships.length)}%` : "—"} icon="chart" />
          </div>
          <Scholarships db={db} />
        </>
      )}
    </>
  );
}


function Scholarships({ db }: { db: DemoDb }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState<Scholarship | "new" | null>(null);
  const manage = can("finance.manage");
  return (
    <Card>
      <Toolbar>
        <span className="text-sm text-muted">A percentage of the tuition fee, applied when invoices are generated.</span>
        {manage && (
          <Button size="sm" icon="plus" className="ml-auto" onClick={() => setEditing("new")}>
            Add scholarship
          </Button>
        )}
      </Toolbar>
      <Table head={["Scholarship", "Waiver", "Students", "Waived so far", ""]} empty={!db.scholarships.length && <EmptyState icon="graduation" title="No scholarships yet" />}>
        {db.scholarships.map((s) => (
          <Tr key={s.id}>
            <Td className="font-medium">{s.name}</Td>
            <Td>
              <Badge tone="success">{s.percent}% of tuition</Badge>
            </Td>
            <Td className="max-w-80 text-xs text-muted">{s.studentIds.map((id) => lookup(db.students, id)?.name).filter(Boolean).join(", ") || "—"}</Td>
            <Td className="tabular-nums">{taka(waivedBy(db, s))}</Td>
            <Td className="text-right">
              {manage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== "new" ? `Edit ${editing.name}` : "Add scholarship"} size="lg">
        {editing !== null && <ScholarshipForm db={db} scholarship={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function ScholarshipForm({ db, scholarship, onDone }: { db: DemoDb; scholarship: Scholarship | null; onDone: () => void }) {
  const { update } = useDemo();
  const toast = useToast();
  const [name, setName] = useState(scholarship?.name ?? "");
  const [percent, setPercent] = useState(String(scholarship?.percent ?? 25));
  const [selected, setSelected] = useState<string[]>(scholarship?.studentIds ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const candidates = db.students.filter((s) => s.status === "ACTIVE" && (!q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))).slice(0, 40);
  const elsewhere = (id: string) => db.scholarships.find((x) => x.id !== scholarship?.id && x.studentIds.includes(id));

  function save() {
    const pct = Number(percent);
    if (name.trim().length < 3) return setError("Enter a name.");
    if (!(pct > 0 && pct <= 100)) return setError("The waiver must be between 1 and 100%.");
    update((d) => {
      // One scholarship per student: moving a student here removes them from the other one.
      d.scholarships.forEach((x) => {
        if (x.id !== scholarship?.id) x.studentIds = x.studentIds.filter((id) => !selected.includes(id));
      });
      if (scholarship) Object.assign(d.scholarships.find((x) => x.id === scholarship.id)!, { name: name.trim(), percent: pct, studentIds: selected });
      else d.scholarships.push({ id: newId(), name: name.trim(), percent: pct, studentIds: selected });
    });
    toast("Scholarship saved. It applies to invoices generated from now on.");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Freedom fighter quota" />
        </Field>
        <Field label="Waiver %">
          <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium">Students ({selected.length})</p>
          <SearchInput value={query} onChange={setQuery} placeholder="Find a student" />
        </div>
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {candidates.map((s) => {
            const other = elsewhere(s.id);
            return (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2/60">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))} className="size-4 accent-[var(--accent)]" />
                  <span className="flex-1">
                    {s.name} <span className="font-mono text-xs text-muted">{s.studentId}</span>
                  </span>
                  {other && <span className="text-xs text-warning">has {other.name}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <ErrorNote message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save}>Save scholarship</Button>
      </FormActions>
    </div>
  );
}
