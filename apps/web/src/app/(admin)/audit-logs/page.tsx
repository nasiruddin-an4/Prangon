"use client";

import { useState } from "react";
import type { Paginated } from "@edumanage/shared";
import { useApi } from "@/lib/use-api";
import { Avatar, Card, EmptyState, ErrorNote, formatDate, Loading, PageHeader, Pagination, SearchInput, Table, Td, Tr } from "@/components/ui";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  changes: unknown;
  createdAt: string;
}

/** Hide secrets that might sit in a change payload. */
function summarise(changes: unknown) {
  if (!changes || typeof changes !== "object") return "—";
  return Object.entries(changes as Record<string, unknown>)
    .filter(([k]) => !/password|secret|token/i.test(k))
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<Paginated<AuditLog>>(`/audit-logs?page=${page}&pageSize=25&search=${encodeURIComponent(search)}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive change: who made it and when. Entries can't be edited or deleted." />
      <Card
        title={<SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Filter by action, person or record" />}
        actions={data && <span className="text-xs text-muted">{data.total} entries</span>}
      >
        <ErrorNote message={error?.message} />
        {loading && !data ? (
          <Loading />
        ) : (
          <Table head={["When", "Who", "Action", "Details"]} empty={!data?.items.length && <EmptyState icon="history" title="No entries" />}>
            {data?.items.map((log) => (
              <Tr key={log.id}>
                <Td className="text-xs whitespace-nowrap text-muted">{formatDate(log.createdAt, true)}</Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={log.actorName ?? "System"} size="sm" />
                    <span className="whitespace-nowrap">{log.actorName ?? "System"}</span>
                  </div>
                </Td>
                <Td>
                  <code className="rounded-md bg-surface-3 px-2 py-0.5 font-mono text-xs whitespace-nowrap">{log.action}</code>
                </Td>
                <Td className="max-w-md truncate text-xs text-muted">{summarise(log.changes)}</Td>
              </Tr>
            ))}
          </Table>
        )}
        <Pagination page={page} pages={pages} onPage={setPage} />
      </Card>
    </>
  );
}
