"use client";

import { useState, type FormEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { useDemo } from "@/lib/demo/store";
import { person as personInfo } from "@/lib/demo/logic";
import type { DemoDb, PersonRef, PersonType } from "@/lib/demo/types";
import { Icon } from "./icons";
import { Button, cx, ErrorNote, Field, FormActions, Input, Select, useToast } from "./ui";

/** Underlined tab bar; `count` shows a small number next to the label. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (key: K) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
            value === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-text",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("rounded-full px-1.5 py-px text-[11px] tabular-nums", value === t.key ? "bg-accent-soft" : "bg-surface-3")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Tells people the module runs on browser storage, with a way to start over. */
export function DemoNotice() {
  const { reset } = useDemo();
  const toast = useToast();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-dashed border-warning/40 bg-warning/8 py-1 pr-1 pl-3 text-xs text-warning">
      <Icon name="info" className="size-3.5" />
      <span className="mr-1 font-medium">Demo data, saved in this browser</span>
      <button
        onClick={() => {
          if (!window.confirm("Reset all demo data for this institution? Your changes in Admissions, Students, Academics, Attendance, Exams and Fees will be lost.")) return;
          reset();
          toast("Demo data reset");
        }}
        className="rounded-md px-2 py-1 font-medium hover:bg-warning/12"
      >
        Reset
      </button>
    </div>
  );
}

/** Toolbar row above a table: filters on the left, actions on the right. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">{children}</div>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "min-h-20 w-full rounded-lg border border-border-strong bg-surface-2/60 px-3 py-2 text-sm text-text placeholder:text-subtle focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15 focus:outline-none",
        className,
      )}
    />
  );
}

/** Compact select for toolbars. */
export function FilterSelect({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 pr-7 text-sm text-text focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none"
    >
      {children}
    </select>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "warning" | "danger" }) {
  const color = { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={cx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Label/value pairs for profile and detail views. */
export function InfoGrid({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-subtle">{label}</dt>
          <dd className="truncate text-sm">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Loading state shared by the demo modules while sign-in resolves. */
export function DemoLoading() {
  return (
    <div className="flex items-center justify-center gap-3 px-5 py-20 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      Loading…
    </div>
  );
}

/** The institution's student ID format (Settings), falling back to the default. */
export function useStudentIdFormat() {
  const { can } = useAuth();
  const { data } = useApi<{ studentIdFormat: string }>(can("institution.settings.read") ? "/institution" : null);
  return data?.studentIdFormat ?? "{YY}{DEPT}{SEQ:4}";
}

/** Active campuses from the API, for campus pickers. */
export function useCampusOptions() {
  const { can } = useAuth();
  const { data } = useApi<{ id: string; name: string; code: string; isActive: boolean }[]>(can("campuses.read") ? "/campuses" : null);
  return (data ?? []).filter((c) => c.isActive);
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" icon="printer" onClick={() => window.print()} className="no-print">
      {label}
    </Button>
  );
}


export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  wide?: boolean;
  defaultValue?: string | number | null;
}

/** Small form from field definitions; `onSubmit` returns an error message to show, or nothing. */
export function EntityForm({ fields, submitLabel, onSubmit, onCancel }: { fields: FieldDef[]; submitLabel: string; onSubmit: (values: Record<string, string>) => string | void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    const missing = fields.filter((f) => f.required && !values[f.name]).map((f) => f.label);
    if (missing.length) return setError(`Fill in: ${missing.join(", ")}`);
    const problem = onSubmit(values);
    if (problem) setError(problem);
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f, i) => (
        <Field key={f.name} label={f.label} hint={f.hint} className={f.wide ? "sm:col-span-2" : undefined}>
          {f.type === "select" ? (
            <Select name={f.name} defaultValue={f.defaultValue ?? undefined}>
              {f.options!.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input name={f.name} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} defaultValue={f.defaultValue ?? undefined} required={f.required} autoFocus={i === 0} />
          )}
        </Field>
      ))}
      <ErrorNote message={error} />
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </FormActions>
    </form>
  );
}

export const opts = <T extends { id: string }>(list: T[], label: (x: T) => string) => list.map((x) => ({ value: x.id, label: label(x) }));


/** Pick a student, teacher or staff member. Students are listed by section. */
export function PersonPicker({ db, types, value, onChange }: { db: DemoDb; types: PersonType[]; value: PersonRef | null; onChange: (ref: PersonRef | null) => void }) {
  const [type, setType] = useState<PersonType>(value?.type ?? types[0]!);
  const options =
    type === "STUDENT"
      ? db.students.filter((s) => s.status === "ACTIVE").sort((a, b) => a.studentId.localeCompare(b.studentId)).map((s) => ({ id: s.id, label: `${s.studentId} · ${s.name}` }))
      : type === "TEACHER"
        ? db.teachers.map((t) => ({ id: t.id, label: t.name }))
        : db.staff.filter((s) => s.status !== "RESIGNED").map((s) => ({ id: s.id, label: `${s.name} · ${s.office}` }));
  return (
    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
      {types.length > 1 && (
        <Select
          aria-label="Person type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as PersonType);
            onChange(null);
          }}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "STUDENT" ? "Student" : t === "TEACHER" ? "Teacher" : "Staff"}
            </option>
          ))}
        </Select>
      )}
      <Select aria-label="Person" value={value?.type === type ? value.id : ""} onChange={(e) => onChange(e.target.value ? { type, id: e.target.value } : null)} className={types.length > 1 ? undefined : "sm:col-span-2"}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Name with a small descriptor line, for any person reference. */
export function PersonCell({ db, refValue }: { db: DemoDb; refValue: PersonRef }) {
  const p = personInfo(db, refValue);
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{p.name}</p>
      <p className="truncate text-xs text-muted">
        {p.kind} · {p.detail}
      </p>
    </div>
  );
}
