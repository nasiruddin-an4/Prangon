"use client";

import { confirmAction } from "@/lib/alerts";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { lookup, newId, nowIso, todayDhaka } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Notice, NoticeAudience } from "@/lib/demo/types";
import { DemoLoading, DemoNotice, Tabs, Textarea } from "@/components/demo";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, cx, EmptyState, ErrorNote, Field, FormActions, formatDate, IconButton, Input, Modal, PageHeader, SearchInput, Select, timeAgo, useToast } from "@/components/ui";

const AUDIENCE: Record<NoticeAudience, { label: string; tone: "accent" | "success" | "warning" | "neutral" }> = {
  EVERYONE: { label: "Everyone", tone: "accent" },
  STUDENTS: { label: "Students", tone: "success" },
  GUARDIANS: { label: "Guardians", tone: "warning" },
  TEACHERS: { label: "Teachers", tone: "neutral" },
  STAFF: { label: "Staff", tone: "neutral" },
};

const isExpired = (n: Notice, today: string) => !!n.expiresOn && n.expiresOn < today;

export default function NoticesPage() {
  const { can } = useAuth();
  const { db } = useDemo();
  const [audience, setAudience] = useState<NoticeAudience | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const [editing, setEditing] = useState<Notice | "new" | null>(null);
  const manage = can("announcements.manage");

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Notices"
        description="Announcements for students, guardians, teachers and staff. Pinned notices stay on top and appear on the dashboard."
        actions={
          <>
            <DemoNotice />
            {manage && (
              <Button icon="plus" onClick={() => setEditing("new")}>
                New notice
              </Button>
            )}
          </>
        }
      />
      {!db ? (
        <DemoLoading />
      ) : (
        <NoticeBoard db={db} audience={audience} setAudience={setAudience} query={query} setQuery={setQuery} showExpired={showExpired} setShowExpired={setShowExpired} onEdit={manage ? setEditing : undefined} onNew={manage ? () => setEditing("new") : undefined} />
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== "new" ? "Edit notice" : "New notice"} description="SMS and email delivery starts once a provider is connected; for now notices show here and on the dashboard." size="lg">
        {editing !== null && db && <NoticeForm db={db} notice={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function NoticeBoard({
  db,
  audience,
  setAudience,
  query,
  setQuery,
  showExpired,
  setShowExpired,
  onEdit,
  onNew,
}: {
  db: DemoDb;
  audience: NoticeAudience | "ALL";
  setAudience: (a: NoticeAudience | "ALL") => void;
  query: string;
  setQuery: (q: string) => void;
  showExpired: boolean;
  setShowExpired: (v: boolean) => void;
  onEdit?: (n: Notice) => void;
  onNew?: () => void;
}) {
  const { update } = useDemo();
  const toast = useToast();
  const today = todayDhaka();
  const q = query.trim().toLowerCase();
  const live = db.notices.filter((n) => showExpired || !isExpired(n, today));
  const rows = live
    .filter((n) => (audience === "ALL" || n.audience === audience) && (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt));
  const count = (a: NoticeAudience) => live.filter((n) => n.audience === a).length;

  return (
    <>
      <Tabs
        value={audience}
        onChange={setAudience}
        tabs={[{ key: "ALL" as const, label: "All", count: live.length }, ...(Object.keys(AUDIENCE) as NoticeAudience[]).map((a) => ({ key: a, label: AUDIENCE[a].label, count: count(a) }))]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search notices" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Show expired
        </label>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="info" title="No notices here" description="Nothing for this audience right now." action={onNew && <Button icon="plus" onClick={onNew}>New notice</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((n) => {
            const expired = isExpired(n, today);
            return (
              <article key={n.id} className={cx("rounded-2xl border bg-surface p-5 shadow-card", n.pinned ? "border-accent/35" : "border-border", expired && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {n.pinned && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                          <Icon name="pin" className="size-3.5" />
                          Pinned
                        </span>
                      )}
                      <Badge tone={AUDIENCE[n.audience].tone}>{AUDIENCE[n.audience].label}</Badge>
                      {n.sectionId && <Badge>{lookup(db.sections, n.sectionId)?.name ?? "Section"}</Badge>}
                      {expired && <Badge tone="danger">Expired</Badge>}
                    </div>
                    <h2 className="font-semibold">{n.title}</h2>
                    <p className="mt-1 text-sm whitespace-pre-line text-muted">{n.body}</p>
                    <p className="mt-3 text-xs text-subtle">
                      {n.author} · {timeAgo(n.publishedAt)}
                      {n.expiresOn && !expired && ` · until ${formatDate(n.expiresOn)}`}
                    </p>
                  </div>
                  {onEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          update((d) => {
                            const x = d.notices.find((y) => y.id === n.id)!;
                            x.pinned = !x.pinned;
                          });
                          toast(n.pinned ? "Unpinned" : "Pinned to the top");
                        }}
                      >
                        {n.pinned ? "Unpin" : "Pin"}
                      </Button>
                      <IconButton icon="pencil" label="Edit" onClick={() => onEdit(n)} />
                      <IconButton icon="trash" label="Delete" tone="danger"
                        onClick={async () => {
                          if (!(await confirmAction({ title: "Delete this notice?", text: n.title, confirmText: "Delete", danger: true }))) return;
                          update((d) => {
                            d.notices = d.notices.filter((x) => x.id !== n.id);
                          });
                          toast("Notice deleted");
                        }}
                      
/>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function NoticeForm({ db, notice, onDone }: { db: DemoDb; notice: Notice | null; onDone: () => void }) {
  const { update, actor } = useDemo();
  const toast = useToast();
  const [audience, setAudience] = useState<NoticeAudience>(notice?.audience ?? "EVERYONE");
  const [error, setError] = useState<string | null>(null);
  const sectionTargeted = audience === "STUDENTS" || audience === "GUARDIANS";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    if (f.title!.length < 4) return setError("Give the notice a title.");
    if (f.body!.length < 10) return setError("Write the notice text.");
    if (f.expiresOn && f.expiresOn < todayDhaka()) return setError("The expiry date can't be in the past.");
    const values = {
      title: f.title!,
      body: f.body!,
      audience,
      sectionId: sectionTargeted ? f.sectionId || null : null,
      pinned: f.pinned === "on",
      expiresOn: f.expiresOn || null,
      author: f.author || actor,
    };
    update((d) => {
      if (notice) Object.assign(d.notices.find((n) => n.id === notice.id)!, values);
      else d.notices.push({ id: newId(), ...values, publishedAt: nowIso() });
    });
    toast(notice ? "Notice updated" : "Notice published");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <Input name="title" defaultValue={notice?.title} required autoFocus />
      </Field>
      <Field label="Notice" className="sm:col-span-2">
        <Textarea name="body" defaultValue={notice?.body} required className="min-h-32" />
      </Field>
      <Field label="Audience">
        <Select value={audience} onChange={(e) => setAudience(e.target.value as NoticeAudience)}>
          {(Object.keys(AUDIENCE) as NoticeAudience[]).map((a) => (
            <option key={a} value={a}>
              {AUDIENCE[a].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Section" hint={sectionTargeted ? "Leave as all to reach every section" : "Only for students or guardians"}>
        <Select name="sectionId" defaultValue={notice?.sectionId ?? ""} disabled={!sectionTargeted}>
          <option value="">All sections</option>
          {db.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Posted by" hint="Shown under the notice">
        <Input name="author" defaultValue={notice?.author} placeholder={actor} />
      </Field>
      <Field label="Expires on" hint="Hidden from the board after this date">
        <Input name="expiresOn" type="date" defaultValue={notice?.expiresOn ?? ""} />
      </Field>
      <label className="col-span-full flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="pinned" defaultChecked={notice?.pinned ?? false} className="size-4 accent-[var(--accent)]" />
        Pin to the top and show on the dashboard
      </label>
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{notice ? "Save changes" : "Publish notice"}</Button>
      </FormActions>
    </form>
  );
}
