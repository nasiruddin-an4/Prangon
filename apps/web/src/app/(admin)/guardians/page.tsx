"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadCsv, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { Guardian } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, FilterSelect, Toolbar } from "@/components/demo";
import { GuardianForm, StudentProfile } from "@/components/students";
import { Avatar, Button, Card, EmptyState, Modal, PageHeader, Pagination, SearchInput, StatCard, Table, Td, Tr } from "@/components/ui";

const PAGE_SIZE = 15;

export default function GuardiansPage() {
  const { db } = useDemo();
  const [profile, setProfile] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Students" title="Guardians" description="Parents and guardians with the students they're responsible for. Add a guardian from a student's profile." actions={<DemoNotice />} />
      {!db ? (
        <DemoLoading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Guardians" value={db.guardians.length} icon="user" />
            <StatCard label="Fathers" value={db.guardians.filter((g) => g.relation === "Father").length} icon="users" />
            <StatCard label="Mothers" value={db.guardians.filter((g) => g.relation === "Mother").length} icon="users" />
            <StatCard label="With email" value={db.guardians.filter((g) => g.email).length} icon="info" />
          </div>
          <GuardianList onOpen={setProfile} />
        </>
      )}
      <StudentProfile studentId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

function GuardianList({ onOpen }: { onOpen: (studentId: string) => void }) {
  const { can } = useAuth();
  const { db } = useDemo();
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Guardian | null>(null);
  if (!db) return null;
  const q = query.trim().toLowerCase();
  const rows = db.guardians.filter((g) => (!relation || g.relation === relation) && (!q || g.name.toLowerCase().includes(q) || g.phone.includes(q)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const childrenOf = (id: string) => db.students.filter((s) => s.guardianIds.includes(id));

  return (
    <Card>
      <Toolbar>
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search name or mobile" />
        <FilterSelect label="Relation" value={relation} onChange={(v) => { setRelation(v); setPage(1); }}>
          <option value="">Any relation</option>
          {["Father", "Mother", "Brother", "Sister", "Uncle", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </FilterSelect>
        <span className="ml-auto text-xs text-muted">{rows.length} guardians</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(`guardians-${todayDhaka()}.csv`, [
              ["Name", "Relation", "Mobile", "Email", "Occupation", "Students"],
              ...rows.map((g) => [g.name, g.relation, g.phone, g.email, g.occupation, childrenOf(g.id).map((s) => `${s.name} (${s.studentId})`).join("; ")]),
            ])
          }
        >
          Export CSV
        </Button>
      </Toolbar>
      <Table head={["Guardian", "Relation", "Mobile", "Occupation", "Students", ""]} empty={!rows.length && <EmptyState icon="user" title="No guardians match" />}>
        {rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((g) => (
          <Tr key={g.id}>
            <Td>
              <div className="flex items-center gap-3">
                <Avatar name={g.name} size="sm" />
                <span className="font-medium">{g.name}</span>
              </div>
            </Td>
            <Td className="text-muted">{g.relation}</Td>
            <Td className="text-muted tabular-nums">{g.phone}</Td>
            <Td className="text-muted">{g.occupation ?? "—"}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {childrenOf(g.id).map((s) => (
                  <button key={s.id} onClick={() => onOpen(s.id)} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs hover:bg-accent-soft hover:text-accent">
                    {s.name}
                  </button>
                ))}
              </div>
            </Td>
            <Td className="text-right">
              {can("guardians.manage") && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                  Edit
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={current} pages={pages} onPage={setPage} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit guardian">
        <GuardianForm guardian={editing} onDone={() => setEditing(null)} />
      </Modal>
    </Card>
  );
}

