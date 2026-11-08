"use client";

import { useState, type FormEvent } from "react";
import { createCampusSchema } from "@edumanage/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, FormActions, Input, issuesToMessage, Loading, Modal, PageHeader, Table, Td, Tr, useToast } from "@/components/ui";

interface Campus {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  division: string | null;
  upazila: string | null;
  isMain: boolean;
  isActive: boolean;
}

const DIVISIONS = ["Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"];

export default function CampusesPage() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi<Campus[]>("/campuses");
  const [editing, setEditing] = useState<Campus | "new" | null>(null);
  const manage = can("campuses.manage");

  return (
    <>
      <PageHeader
        title="Campuses"
        description="Your institution's locations. A role can be limited to one campus, for example a Campus Admin."
        actions={manage && <Button icon="plus" onClick={() => setEditing("new")}>Add campus</Button>}
      />
      <Card>
        <ErrorNote message={error?.message} />
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            head={["Campus", "Code", "Location", "Contact", "Status", ""]}
            empty={
              !data?.length && (
                <EmptyState
                  icon="mapPin"
                  title="No campuses yet"
                  description="Add your first campus to start organising students and staff by location."
                  action={manage && <Button icon="plus" onClick={() => setEditing("new")}>Add campus</Button>}
                />
              )
            }
          >
            {data?.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Icon name="mapPin" className="size-4.5" />
                    </span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.isMain && <p className="text-xs text-accent">Main campus</p>}
                    </div>
                  </div>
                </Td>
                <Td>
                  <code className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-xs">{c.code}</code>
                </Td>
                <Td className="text-muted">{[c.upazila, c.district, c.division].filter(Boolean).join(", ") || "—"}</Td>
                <Td className="text-muted">{c.phone ?? c.email ?? "—"}</Td>
                <Td>{c.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>}</Td>
                <Td className="text-right">
                  {manage && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add campus" : "Edit campus"}
        description={editing === "new" ? "Campus codes appear on student IDs, so keep them short." : undefined}
        onClose={() => setEditing(null)}
      >
        <CampusForm
          campus={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      </Modal>
    </>
  );
}

function CampusForm({ campus, onSaved, onCancel }: { campus: Campus | null; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? undefined : v]));
    const parsed = createCampusSchema.safeParse({ ...values, isActive: form.isActive === "on" });
    if (!parsed.success) return setError(issuesToMessage(parsed.error.issues));
    setPending(true);
    try {
      await api(campus ? `/campuses/${campus.id}` : "/campuses", { method: campus ? "PATCH" : "POST", json: parsed.data });
      toast(campus ? "Campus updated" : `${parsed.data.name} added`);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Campus name" className="sm:col-span-2">
        <Input name="name" defaultValue={campus?.name} placeholder="e.g. Uttara Campus" required autoFocus />
      </Field>
      <Field label="Code" hint="Letters and digits, e.g. DHK">
        <Input name="code" defaultValue={campus?.code} required maxLength={16} className="font-mono uppercase" />
      </Field>
      <Field label="Mobile number" hint="Bangladeshi number, 01XXXXXXXXX">
        <Input name="phone" defaultValue={campus?.phone ?? ""} inputMode="tel" placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="Email" className="sm:col-span-2">
        <Input name="email" type="email" defaultValue={campus?.email ?? ""} placeholder="campus@university.edu.bd" />
      </Field>
      <Field label="Division">
        <select name="division" defaultValue={campus?.division ?? ""} className="h-10 w-full rounded-lg border border-border-strong bg-surface-2/60 px-3 text-sm focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none">
          <option value="">Select division</option>
          {DIVISIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <Field label="District">
        <Input name="district" defaultValue={campus?.district ?? ""} />
      </Field>
      <Field label="Upazila / Thana">
        <Input name="upazila" defaultValue={campus?.upazila ?? ""} />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={campus?.address ?? ""} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked={campus?.isActive ?? true} className="size-4 accent-[var(--accent)]" />
        Campus is active
      </label>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : campus ? "Save changes" : "Add campus"}
        </Button>
      </FormActions>
    </form>
  );
}
