"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, cx, ErrorNote, Input, Loading, PageHeader, useToast } from "@/components/ui";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}
interface PermissionDef { key: string; module: string; label: string }

const MODULE_LABELS: Record<string, string> = {
  api_keys: "API keys",
  communication: "Communication",
  portal: "Self-service portals",
};
const moduleLabel = (m: string) => MODULE_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

export default function RolesPage() {
  const { can, me } = useAuth();
  const toast = useToast();
  const roles = useApi<Role[]>("/roles");
  const catalog = useApi<PermissionDef[]>("/permissions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = roles.data?.find((r) => r.id === selectedId) ?? roles.data?.[0];
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
    setError(null);
  }, [selected]);

  const modules = useMemo(() => {
    const groups = new Map<string, PermissionDef[]>();
    for (const p of catalog.data ?? []) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    return [...groups.entries()];
  }, [catalog.data]);

  const editable = !!selected && can("roles.manage") && (selected.key !== "institution_admin" || !!me?.isPlatformAdmin);
  const dirty = !!selected && (draft.size !== selected.permissions.length || selected.permissions.some((p) => !draft.has(p)));

  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(draft);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    setDraft(next);
  };

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/roles/${selected.id}`, { method: "PATCH", json: { permissions: [...draft] } });
      toast(`${selected.name} saved`);
      roles.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function create() {
    if (newName.trim().length < 2) return;
    setError(null);
    try {
      const role = await api<Role>("/roles", { method: "POST", json: { name: newName.trim(), permissions: [] } });
      setNewName("");
      setSelectedId(role.id);
      toast(`Role "${role.name}" created. Choose its permissions.`);
      roles.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function remove() {
    if (!selected || !confirm(`Delete the role "${selected.name}"?`)) return;
    try {
      await api(`/roles/${selected.id}`, { method: "DELETE" });
      toast(`Role "${selected.name}" deleted`);
      setSelectedId(null);
      roles.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  if ((roles.loading && !roles.data) || (catalog.loading && !catalog.data)) return <Loading />;

  return (
    <>
      <PageHeader title="Roles & permissions" description="Each role is a set of permissions. People can hold several roles, each optionally limited to one campus." />
      <ErrorNote message={roles.error?.message ?? catalog.error?.message} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card title="Roles" className="self-start">
          <ul className="space-y-0.5 p-2">
            {roles.data?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    selected?.id === r.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2",
                  )}
                >
                  <Icon name="shield" className={cx("size-4", selected?.id === r.id ? "text-accent" : "text-subtle")} />
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted" title={`${r.userCount} users`}>
                    <Icon name="users" className="size-3.5" />
                    {r.userCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {can("roles.manage") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <Input placeholder="New role name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9" />
              <Button type="submit" size="sm" variant="secondary" icon="plus" disabled={newName.trim().length < 2} className="h-9">
                Add
              </Button>
            </form>
          )}
        </Card>

        {selected && (
          <Card
            title={
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">{selected.name}</h2>
                {selected.isSystem && <Badge>Default</Badge>}
                <Badge tone="accent">{draft.size} permissions</Badge>
              </div>
            }
            description={selected.description ?? undefined}
            actions={
              editable && (
                <div className="flex gap-2">
                  {!selected.isSystem && (
                    <Button size="sm" variant="ghost" onClick={remove}>
                      Delete role
                    </Button>
                  )}
                  {dirty && (
                    <Button size="sm" variant="secondary" onClick={() => setDraft(new Set(selected.permissions))}>
                      Discard
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={!dirty || saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              )
            }
          >
            <div className="space-y-6 p-5">
              {!editable && (
                <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                  <Icon name="lock" className="size-3.5" />
                  {selected.key === "institution_admin" ? "The Institution Admin role always has every permission." : "You can view this role but not change it."}
                </p>
              )}
              <ErrorNote message={error} />
              {modules.map(([module, perms]) => {
                const keys = perms.map((p) => p.key);
                const all = keys.every((k) => draft.has(k));
                return (
                  <fieldset key={module}>
                    <div className="mb-2 flex items-center justify-between">
                      <legend className="text-xs font-semibold tracking-wider text-subtle uppercase">{moduleLabel(module)}</legend>
                      {editable && (
                        <button type="button" onClick={() => toggle(keys, !all)} className="text-xs font-medium text-accent hover:underline">
                          {all ? "Clear" : "Select all"}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {perms.map((p) => {
                        const on = draft.has(p.key);
                        return (
                          <label
                            key={p.key}
                            className={cx(
                              "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                              on ? "border-accent/40 bg-accent-soft/60" : "border-border",
                              editable ? "cursor-pointer hover:border-accent/40" : "opacity-80",
                            )}
                          >
                            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" disabled={!editable} checked={on} onChange={(e) => toggle([p.key], e.target.checked)} />
                            <span className="min-w-0">
                              <span className="block leading-snug">{p.label}</span>
                              <span className="block font-mono text-[11px] text-subtle">{p.key}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
