"use client";

import { lookup, todayDhaka } from "@/lib/demo/logic";
import { noticesFor } from "@/lib/demo/workflows";
import { Icon } from "@/components/icons";
import { PortalPage } from "@/components/portal";
import { Badge, Card, cx, EmptyState, formatDate, timeAgo } from "@/components/ui";

export default function PortalNotices() {
  return (
    <PortalPage title="Notices" description="Notices for all students, and for your section.">
      {({ db, student }) => {
        const notices = noticesFor(db, student, todayDhaka());
        if (!notices.length)
          return (
            <Card>
              <EmptyState icon="megaphone" title="No notices right now" />
            </Card>
          );
        return (
          <div className="space-y-3">
            {notices.map((n) => (
              <article key={n.id} className={cx("rounded-2xl border bg-surface p-5 shadow-card", n.pinned ? "border-accent/35" : "border-border")}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {n.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                      <Icon name="pin" className="size-3.5" />
                      Pinned
                    </span>
                  )}
                  {n.sectionId && <Badge>{lookup(db.sections, n.sectionId)?.name}</Badge>}
                </div>
                <h2 className="font-semibold">{n.title}</h2>
                <p className="mt-1 text-sm whitespace-pre-line text-muted">{n.body}</p>
                <p className="mt-3 text-xs text-subtle">
                  {n.author} · {timeAgo(n.publishedAt)}
                  {n.expiresOn && ` · until ${formatDate(n.expiresOn)}`}
                </p>
              </article>
            ))}
          </div>
        );
      }}
    </PortalPage>
  );
}
