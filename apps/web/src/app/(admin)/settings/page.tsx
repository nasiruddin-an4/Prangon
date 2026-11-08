"use client";

import { useState, type FormEvent } from "react";
import { updateInstitutionSettingsSchema } from "@edumanage/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { Badge, Button, Card, ErrorNote, Field, formatDate, Input, issuesToMessage, Loading, PageHeader, Select, useToast } from "@/components/ui";

interface Institution {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  type: string;
  status: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  defaultLocale: string;
  studentIdFormat: string;
  trialEndsAt: string | null;
  updatedAt: string;
}

/** What a student ID would look like with this format, for the live preview. */
function previewId(format: string) {
  return format
    .replace("{YYYY}", "2026")
    .replace("{YY}", "26")
    .replace("{CAMPUS}", "DHK")
    .replace("{DEPT}", "CSE")
    .replace(/\{SEQ:(\d)\}/, (_, n: string) => "1".padStart(Number(n), "0"));
}

export default function SettingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Institution>("/institution");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idFormat, setIdFormat] = useState<string | null>(null);
  const editable = can("institution.settings.update");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = updateInstitutionSettingsSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v])));
    if (!parsed.success) return setFormError(issuesToMessage(parsed.error.issues));
    setSaving(true);
    try {
      await api("/institution", { method: "PATCH", json: parsed.data });
      toast("Settings saved");
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote message={error?.message ?? "Not found"} />;
  const format = idFormat ?? data.studentIdFormat;

  return (
    <>
      <PageHeader
        title="Institution settings"
        description={`People sign in with the institution code “${data.slug}”.`}
        actions={
          <>
            <Badge tone="accent">{data.type.replace("_", " ")}</Badge>
            <Badge tone={data.status === "ACTIVE" ? "success" : "warning"} dot>
              {data.status}
              {data.status === "TRIAL" && data.trialEndsAt && ` · until ${formatDate(data.trialEndsAt)}`}
            </Badge>
          </>
        }
      />
      <form key={data.updatedAt} onSubmit={submit}>
        <fieldset disabled={!editable} className="space-y-6">
          <Card title="Profile" description="Shown on documents, ID cards and the portals.">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Institution name" className="sm:col-span-2"><Input name="name" defaultValue={data.name} /></Field>
              <Field label="Short name" hint="e.g. DU, BUET"><Input name="shortName" defaultValue={data.shortName ?? ""} /></Field>
              <Field label="Website"><Input name="website" type="url" defaultValue={data.website ?? ""} placeholder="https://" /></Field>
              <Field label="Email"><Input name="email" type="email" defaultValue={data.email ?? ""} /></Field>
              <Field label="Mobile number"><Input name="phone" defaultValue={data.phone ?? ""} placeholder="01XXXXXXXXX" /></Field>
              <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={data.address ?? ""} /></Field>
            </div>
          </Card>
          <Card title="Localisation & numbering">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Default language">
                <Select name="defaultLocale" defaultValue={data.defaultLocale}>
                  <option value="en">English</option>
                  <option value="bn">বাংলা (Bangla)</option>
                </Select>
              </Field>
              <Field label="Timezone"><Input name="timezone" defaultValue={data.timezone} /></Field>
              <Field label="Currency" hint="Set when the institution is created"><Input value={data.currency} disabled readOnly /></Field>
              <Field label="Student ID format" hint="{YYYY} {YY} {CAMPUS} {DEPT} {SEQ:n}">
                <Input name="studentIdFormat" defaultValue={data.studentIdFormat} onChange={(e) => setIdFormat(e.target.value)} className="font-mono" />
              </Field>
              <div className="flex items-center justify-between rounded-xl border border-dashed border-border-strong bg-surface-2/50 px-4 py-3 sm:col-span-2">
                <span className="text-xs text-muted">Next student ID would look like</span>
                <code className="font-mono text-sm font-semibold text-accent">{previewId(format)}</code>
              </div>
            </div>
          </Card>
          {editable && (
            <div className="flex items-center justify-end gap-3">
              <ErrorNote message={formError} />
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
            </div>
          )}
        </fieldset>
      </form>
    </>
  );
}
