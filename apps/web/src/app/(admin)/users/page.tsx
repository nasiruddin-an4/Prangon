"use client";

import { useState, type FormEvent } from "react";
import { createUserSchema, updateUserSchema, type Paginated } from "@edumanage/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  FormActions,
  Input,
  issuesToMessage,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Table,
  Td,
  timeAgo,
  Tr,
  useToast,
} from "@/components/ui";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  lastSignInAt: string | null;
  roles: { id: string; campusId: string | null; role: { id: string; name: string }; campus: { name: string } | null }[];
}
interface Role { id: string; name: string; key: string; description: string | null }
interface Campus { id: string; name: string }

const statusTone = { ACTIVE: "success", SUSPENDED: "warning", DISABLED: "danger" } as const;

export default function UsersPage() {
  const { can, me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<UserRow>>(`/users?page=${page}&search=${encodeURIComponent(search)}`);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const manage = can("users.manage");
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function setStatus(user: UserRow, status: UserRow["status"]) {
    try {
      await api(`/users/${user.id}`, { method: "PATCH", json: { status } });
      toast(status === "ACTIVE" ? `${user.fullName} reactivated` : `${user.fullName} suspended and signed out`);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff and portal accounts. What each person can do comes from their roles."
        actions={manage && <Button icon="plus" onClick={() => setEditing("new")}>Add user</Button>}
      />
      <Card
        title={
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, email or mobile"
          />
        }
        actions={data && <span className="text-xs text-muted">{data.total} {data.total === 1 ? "user" : "users"}</span>}
      >
        <ErrorNote message={error?.message} />
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            head={["Name", "Roles", "Status", "Last sign-in", ""]}
            empty={!data?.items.length && <EmptyState icon="users" title={search ? "No matching users" : "No users yet"} description={search ? "Try a different name or email." : undefined} />}
          >
            {data?.items.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.fullName} />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {u.fullName} {u.id === me?.id && <span className="text-xs font-normal text-muted">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.id} tone="accent">
                        {r.role.name}
                        {r.campus && <span className="opacity-70">· {r.campus.name}</span>}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  <Badge tone={statusTone[u.status]} dot>
                    {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                  </Badge>
                </Td>
                <Td className="text-muted">{u.lastSignInAt ? timeAgo(u.lastSignInAt) : "Never"}</Td>
                <Td className="text-right whitespace-nowrap">
                  {manage && u.id !== me?.id && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(u, u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>
                        {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </Button>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pages={pages} onPage={setPage} />
      </Card>
      <Modal
        open={editing !== null}
        title={editing === "new" ? "Add user" : "Edit user"}
        description={editing === "new" ? "They sign in with your institution code, their email and this password." : undefined}
        onClose={() => setEditing(null)}
      >
        <UserForm
          user={editing === "new" ? null : editing}
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

function UserForm({ user, onSaved, onCancel }: { user: UserRow | null; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const roles = useApi<Role[]>("/roles");
  const campuses = useApi<Campus[]>("/campuses");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = user?.roles[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const f = new FormData(event.currentTarget);
    const assignment = [{ roleId: f.get("roleId"), campusId: f.get("campusId") || null }];
    const parsed = user
      ? updateUserSchema.safeParse({ fullName: f.get("fullName"), phone: f.get("phone") || undefined, roles: assignment })
      : createUserSchema.safeParse({
          fullName: f.get("fullName"),
          email: f.get("email"),
          phone: f.get("phone") || undefined,
          password: f.get("password"),
          roles: assignment,
        });
    if (!parsed.success) return setError(issuesToMessage(parsed.error.issues));
    setPending(true);
    try {
      await api(user ? `/users/${user.id}` : "/users", { method: user ? "PATCH" : "POST", json: parsed.data });
      toast(user ? "User updated" : `${f.get("fullName")} added`);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setPending(false);
    }
  }

  if (roles.loading || campuses.loading) return <Loading />;

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" className="sm:col-span-2">
        <Input name="fullName" defaultValue={user?.fullName} required autoFocus />
      </Field>
      <Field label="Email" hint={user ? "Email can't be changed" : undefined}>
        <Input name="email" type="email" defaultValue={user?.email} disabled={!!user} required={!user} />
      </Field>
      <Field label="Mobile number">
        <Input name="phone" defaultValue={user?.phone ?? ""} inputMode="tel" placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="Role">
        <Select name="roleId" defaultValue={current?.role.id} required>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Campus" hint="All campuses = institution-wide">
        <Select name="campusId" defaultValue={current?.campusId ?? ""}>
          <option value="">All campuses</option>
          {campuses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {user && user.roles.length > 1 && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning sm:col-span-2">
          This user has {user.roles.length} roles ({user.roles.map((r) => r.role.name).join(", ")}). Saving replaces them with the role selected above.
        </p>
      )}
      {!user && (
        <Field label="Temporary password" hint="At least 10 characters. Share it privately." className="sm:col-span-2">
          <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
      )}
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : user ? "Save changes" : "Add user"}
        </Button>
      </FormActions>
    </form>
  );
}
