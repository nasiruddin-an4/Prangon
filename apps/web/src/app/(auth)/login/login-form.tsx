"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signInSchema } from "@edumanage/shared";
import { api, ApiError } from "@/lib/api";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

/**
 * One form for everyone: institution users enter their institution code;
 * platform administrators leave it empty.
 */
export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const expired = params.get("expired") === "1";
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const institution = String(form.get("institution") ?? "").trim();
    const parsed = signInSchema.safeParse({
      institution: institution || undefined,
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("\n"));
      return;
    }
    setPending(true);
    try {
      await api("/auth/sign-in", { method: "POST", json: parsed.data });
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError(
          parsed.data.institution
            ? `Invalid email or password for institution "${parsed.data.institution}". Platform administrators: leave the institution code empty.`
            : "Invalid email or password for a platform administrator. Institution users: enter your institution code.",
        );
      } else {
        setError(e instanceof ApiError ? e.message : "Could not reach the server");
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="Institution code" hint="e.g. demo-university · platform administrators leave this empty">
        <Input name="institution" autoComplete="organization" placeholder="your-university" autoFocus className="font-mono" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {expired && !error && (
        <p className="rounded-xl border border-info/25 bg-info/8 px-3.5 py-2.5 text-sm text-info">Your session has ended. Please sign in again.</p>
      )}
      <ErrorNote message={error} />
      <Button type="submit" className="mt-2 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
