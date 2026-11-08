import type { TicketStatus, WorkflowEvent } from "@/lib/demo/types";
import { cx, timeAgo } from "./ui";

export const TICKET_TONE: Record<TicketStatus, "neutral" | "accent" | "warning" | "success"> = { SUBMITTED: "neutral", ASSIGNED: "accent", UNDER_REVIEW: "warning", RESOLVED: "success", CLOSED: "neutral" };
export const TICKET_CATEGORIES = ["Academic", "Accounts", "Facilities", "Hostel", "Transport", "Counselling", "Harassment / ragging", "Record correction", "Other"];

/** Who did what, oldest first; the latest step is highlighted. */
export function Timeline({ events }: { events: WorkflowEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((e, i) => (
        <li key={i} className="relative flex gap-3 text-sm">
          <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", i === events.length - 1 ? "bg-accent" : "bg-border-strong")} />
          <div>
            <p>{e.text}</p>
            <p className="text-xs text-subtle">
              {e.by} · {timeAgo(e.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
