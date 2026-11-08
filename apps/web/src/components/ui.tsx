"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./icons";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// ── Buttons & form controls ──────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Button look, also for links that act as buttons. */
export const buttonStyles = (variant: ButtonVariant = "primary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
    variant === "primary" && "bg-accent text-accent-text shadow-soft hover:bg-accent-hover",
    variant === "secondary" && "border border-border-strong bg-surface text-text shadow-soft hover:bg-surface-2",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-text",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
  );

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: IconName }) {
  return (
    <button
      {...props}
      className={cx(buttonStyles(variant, size), className)}
    >
      {icon && <Icon name={icon} className={size === "md" ? "size-4" : "size-3.5"} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-text">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

const control =
  "w-full rounded-lg border border-border-strong bg-surface-2/60 px-3 text-sm text-text placeholder:text-subtle transition-colors focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, "h-10", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, "h-10 pr-8", className)} />;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(control, "h-9 pl-9 font-normal")} />
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────

export function Card({ title, description, actions, children, className }: { title?: ReactNode; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-border bg-surface shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {typeof title === "string" ? <h2 className="text-[15px] font-semibold">{title}</h2> : title}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wider text-accent uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
} as const;

export function Badge({ tone = "neutral", dot, children }: { tone?: keyof typeof tones; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  // Stable hue per name, so the same person always gets the same colour.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", size === "md" ? "size-9 text-[13px]" : "size-7 text-[11px]")}
      style={{ background: `oklch(0.6 0.13 ${hue})` }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

export function StatCard({ label, value, sub, icon }: { label: string; value: number | string; sub?: string; icon: IconName }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name={icon} className="size-4.5" />
        </span>
      </div>
      {/* Long values (৳ amounts) shrink on phones and the sub-label wraps instead of widening the page. */}
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-semibold tracking-tight break-all tabular-nums sm:text-3xl">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        {sub && <span className="text-sm font-normal break-normal text-muted">{sub}</span>}
      </p>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon name={icon} className="size-6" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode | boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2/60 text-[11px] font-semibold tracking-wider text-subtle uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={h || i} className="px-5 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {empty ? (
            <tr>
              <td colSpan={head.length}>{empty === true ? <EmptyState icon="info" title="Nothing here yet" /> : empty}</td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-surface-2/50">{children}</tr>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-5 py-3.5 align-middle", className)}>{children}</td>;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm">
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ── Overlays & feedback ──────────────────────────────────────────────────

const MODAL_WIDTH = { md: "w-[min(600px,calc(100vw-32px))]", lg: "w-[min(860px,calc(100vw-32px))]", xl: "w-[min(1100px,calc(100vw-32px))]" };

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof MODAL_WIDTH;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cx("m-auto rounded-2xl border border-border bg-surface p-0 text-text shadow-pop", MODAL_WIDTH[size])}
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
        </div>
        <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Close">
          <Icon name="x" />
        </button>
      </header>
      <div className="max-h-[75vh] overflow-y-auto px-6 pb-6">{open && children}</div>
    </dialog>
  );
}

/** Sticky footer row for forms inside a Modal. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="col-span-full -mx-6 mt-2 flex justify-end gap-2 border-t border-border px-6 pt-4">{children}</div>;
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="col-span-full flex gap-2.5 rounded-xl border border-danger/25 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      <p className="whitespace-pre-line">{message}</p>
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-5 py-14 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      {label}
    </div>
  );
}

interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    // Keep the three most recent, so a burst of actions doesn't cover the page.
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="animate-toast flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-pop">
            <span className={cx("grid size-5 place-items-center rounded-full", t.tone === "success" ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
              <Icon name={t.tone === "success" ? "check" : "alert"} className="size-3" />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export const useToast = () => use(ToastContext);

// ── Formatting ───────────────────────────────────────────────────────────

export function formatDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}

export function timeAgo(value: string | Date) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  return formatDate(value);
}

/** Flattens Zod issues into one readable message. */
export function issuesToMessage(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((i) => (i.path.length ? `${String(i.path.at(-1))}: ${i.message}` : i.message)).join("\n");
}
