"use client";

import { BRAND } from "@/lib/brand";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createInstitutionSchema, type Paginated } from "@edumanage/shared";
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
  formatDate,
  FormActions,
  Input,
  issuesToMessage,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Table,
  Td,
  Tr,
  useToast,
} from "@/components/ui";

interface Institution {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  trialEndsAt: string | null;
  createdAt: string;
  _count: { users: number; campuses: number };
}

const statusTone = { TRIAL: "warning", ACTIVE: "success", SUSPENDED: "danger", CANCELLED: "neutral" } as const;

export default function InstitutionsPage() {
  const router = useRouter();
  const toast = useToast();
  const { selectTenant, refresh } = useAuth();
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useApi<Paginated<Institution>>(`/platform/institutions?pageSize=50&search=${encodeURIComponent(search)}`);
  const [creating, setCreating] = useState(false);

  async function setStatus(i: Institution, status: Institution["status"]) {
    const verb = status === "SUSPENDED" ? "Suspend" : "Activate";
    if (!confirm(`${verb} ${i.name}?${status === "SUSPENDED" ? " Its users are signed out immediately." : ""}`)) return;
    try {
      await api(`/platform/institutions/${i.id}/status`, { method: "PATCH", json: { status } });
      toast(`${i.name} is now ${status.toLowerCase()}`);
      reload();
      void refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  function manage(i: Institution) {
    selectTenant(i.id);
    router.push("/");
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Institutions"
        description={`Every university, college and school on ${BRAND.name}. Each one's data is kept separate.`}
        actions={<Button icon="plus" onClick={() => setCreating(true)}>New institution</Button>}
      />
      <Card title={<SearchInput value={search} onChange={setSearch} placeholder="Search by name or code" />} actions={data && <span className="text-xs text-muted">{data.total} total</span>}>
        <ErrorNote message={error?.message} />
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            head={["Institution", "Type", "Campuses", "Users", "Status", "Created", ""]}
            empty={!data?.items.length && <EmptyState icon="building" title="No institutions" action={<Button icon="plus" onClick={() => setCreating(true)}>New institution</Button>} />}
          >
            {data?.items.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={i.name} />
                    <div className="min-w-0">
                      <p className="font-medium">{i.name}</p>
                      <p className="font-mono text-xs text-muted">{i.slug}</p>
                    </div>
                  </div>
                </Td>
                <Td className="text-muted capitalize">{i.type.replace("_", " ").toLowerCase()}</Td>
                <Td className="tabular-nums">{i._count.campuses}</Td>
                <Td className="tabular-nums">{i._count.users}</Td>
                <Td>
                  <Badge tone={statusTone[i.status]} dot>
                    {i.status.charAt(0) + i.status.slice(1).toLowerCase()}
                  </Badge>
                  {i.status === "TRIAL" && i.trialEndsAt && <p className="mt-1 text-[11px] text-muted">until {formatDate(i.trialEndsAt)}</p>}
                </Td>
                <Td className="text-muted">{formatDate(i.createdAt)}</Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="secondary" onClick={() => manage(i)}>
                    Manage
                  </Button>
                  {i.status !== "ACTIVE" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i, "ACTIVE")}>
                      Activate
                    </Button>
                  )}
                  {i.status !== "SUSPENDED" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i, "SUSPENDED")}>
                      Suspend
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={creating} title="New institution" description="Creates the institution, its main campus, 12 default roles and its first admin." onClose={() => setCreating(false)}>
        <InstitutionForm
          onCancel={() => setCreating(false)}
          onSaved={(name) => {
            setCreating(false);
            toast(`${name} created`);
            reload();
            void refresh();
          }}
        />
      </Modal>
    </>
  );
}

function InstitutionForm({ onSaved, onCancel }: { onSaved: (name: string) => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const f = new FormData(event.currentTarget);
    const s = (k: string) => (f.get(k) as string) || undefined;
    const parsed = createInstitutionSchema.safeParse({
      name: s("name"),
      shortName: s("shortName"),
      slug: s("slug"),
      type: s("type"),
      admin: { fullName: s("adminName"), email: s("adminEmail"), password: s("adminPassword") },
      mainCampus: { name: s("campusName"), code: s("campusCode") },
    });
    if (!parsed.success) return setError(issuesToMessage(parsed.error.issues));
    setPending(true);
    try {
      await api("/platform/institutions", { method: "POST", json: parsed.data });
      onSaved(parsed.data.name);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Institution name" className="sm:col-span-2">
        <Input
          name="name"
          required
          autoFocus
          placeholder="e.g. Daffodil International University"
          onChange={(e) => {
            if (!slugTouched) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48));
          }}
        />
      </Field>
      <Field label="Institution code" hint="Users type this to sign in">
        <Input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="font-mono"
        />
      </Field>
      <Field label="Short name">
        <Input name="shortName" placeholder="e.g. DIU" />
      </Field>
      <Field label="Type" className="sm:col-span-2">
        <Select name="type" defaultValue="UNIVERSITY">
          <option value="UNIVERSITY">University</option>
          <option value="COLLEGE">College</option>
          <option value="SCHOOL">School</option>
          <option value="TRAINING_INSTITUTE">Training institute</option>
        </Select>
      </Field>

      <p className="pt-2 text-xs font-semibold tracking-wider text-subtle uppercase sm:col-span-2">Main campus</p>
      <Field label="Campus name">
        <Input name="campusName" required placeholder="Main Campus" />
      </Field>
      <Field label="Campus code">
        <Input name="campusCode" required placeholder="MAIN" className="font-mono uppercase" />
      </Field>

      <p className="pt-2 text-xs font-semibold tracking-wider text-subtle uppercase sm:col-span-2">First Institution Admin</p>
      <Field label="Full name">
        <Input name="adminName" required />
      </Field>
      <Field label="Email">
        <Input name="adminEmail" type="email" required />
      </Field>
      <Field label="Temporary password" hint="At least 10 characters" className="sm:col-span-2">
        <Input name="adminPassword" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create institution"}
        </Button>
      </FormActions>
    </form>
  );
}
