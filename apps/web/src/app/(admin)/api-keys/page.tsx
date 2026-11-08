"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, EmptyState, ErrorNote, formatDate, Input, Loading, PageHeader, Table, Td, timeAgo, Tr, useToast } from "@/components/ui";

interface ApiKey {
  id: string;
  name: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  user: { fullName: string };
}

export default function ApiKeysPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<ApiKey[]>("/api-keys");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const result = await api<{ key: string; name: string }>("/api-keys", { method: "POST", json: { name: name.trim() } });
      setCreated(result);
      setName("");
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function revoke(key: ApiKey) {
    if (!confirm(`Revoke "${key.name}"? Anything using it stops working immediately.`)) return;
    try {
      await api(`/api-keys/${key.id}`, { method: "DELETE" });
      toast(`"${key.name}" revoked`);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="API keys"
        description="Let other systems (your website, ERP or SMS gateway) use the EduManage API. A key has the same permissions as the person who created it."
      />
      <div className="space-y-6">
        <Card title="Create a key">
          <form onSubmit={create} className="flex flex-wrap gap-2 p-5">
            <Input placeholder="What is it for? e.g. Website admission form" value={name} onChange={(e) => setName(e.target.value)} className="max-w-md flex-1" />
            <Button type="submit" icon="key" disabled={name.trim().length < 2}>
              Create key
            </Button>
          </form>
          {created && (
            <div className="mx-5 mb-5 rounded-xl border border-warning/40 bg-warning/8 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Icon name="alert" className="size-4 text-warning" /> Copy the key for “{created.name}” now. It won&apos;t be shown again.
              </p>
              <div className="mt-3 flex gap-2">
                <code className="block flex-1 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs whitespace-nowrap">{created.key}</code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="copy"
                  className="h-auto"
                  onClick={() => navigator.clipboard.writeText(created.key).then(() => toast("Key copied"))}
                >
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Send it as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.
              </p>
            </div>
          )}
          {actionError && (
            <div className="px-5 pb-5">
              <ErrorNote message={actionError} />
            </div>
          )}
        </Card>
        <Card title="Keys">
          <ErrorNote message={error?.message} />
          {loading && !data ? (
            <Loading />
          ) : (
            <Table head={["Name", "Created by", "Last used", "Expires", "Status", ""]} empty={!data?.length && <EmptyState icon="key" title="No API keys" description="Create one above when an integration needs access." />}>
              {data?.map((k) => (
                <Tr key={k.id}>
                  <Td>
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-subtle">edm_{k.id}_••••</p>
                  </Td>
                  <Td className="text-muted">{k.user.fullName}</Td>
                  <Td className="text-muted">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</Td>
                  <Td className="text-muted">{formatDate(k.expiresAt)}</Td>
                  <Td>
                    {k.revokedAt ? <Badge tone="danger" dot>Revoked</Badge> : new Date(k.expiresAt) < new Date() ? <Badge dot>Expired</Badge> : <Badge tone="success" dot>Active</Badge>}
                  </Td>
                  <Td className="text-right">
                    {!k.revokedAt && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(k)}>
                        Revoke
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
