import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const STEPS = ["Admission", "Enrollment", "Academics", "Attendance", "Exams", "Results", "Fees", "Clearance", "Graduation"];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#1e1b4b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[#4f46e5] opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 size-[460px] rounded-full bg-[#7c3aed] opacity-30 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Icon name="graduation" className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          <span className="text-sm text-white/50">{BRAND.bangla}</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl leading-[1.15] font-semibold tracking-tight">{BRAND.tagline}</h1>
          <p className="mt-4 text-base text-white/70">
            Admissions, academics, attendance, exams, fees, library and a self-service student portal for universities across Bangladesh. Every office works in one place, and work flows between them.
          </p>
          <ol className="mt-10 flex flex-wrap gap-2">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2 rounded-full bg-white/8 py-1 pr-3 pl-1 text-xs text-white/80 ring-1 ring-white/10">
                <span className="grid size-5 place-items-center rounded-full bg-white/15 text-[10px] font-semibold">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-white/50">Secure by design: every institution&apos;s data is kept separate.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-text">
              <Icon name="graduation" className="size-5" />
            </span>
            <span className="text-lg font-semibold">{BRAND.name}</span>
            <span className="text-sm text-subtle">{BRAND.bangla}</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted">Staff and students: sign in with your institution code and university email.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
