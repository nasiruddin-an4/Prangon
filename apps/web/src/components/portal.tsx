"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { lookup } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import type { DemoDb, Student } from "@/lib/demo/types";
import { DemoLoading } from "./demo";
import { Icon } from "./icons";
import { isPortalOnly, PORTAL_NAV } from "./navigation";
import { Avatar, Badge, Card, cx, EmptyState, PageHeader } from "./ui";
import { STATUS_TONE, statusLabel } from "./students";

const PREVIEW_KEY = "edumanage:portal-preview";

/**
 * The student whose portal is showing.
 *
 * - A signed-in student sees only their own record, found by their sign-in
 *   email (the official email set when their login was created). They can't
 *   switch to anyone else.
 * - Staff with students.read preview any student's portal.
 */
export function usePortalStudent() {
  const { me, can } = useAuth();
  const { db } = useDemo();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const student = !!me && isPortalOnly(can, me.isPlatformAdmin);

  useEffect(() => {
    try {
      setPreviewId(window.sessionStorage.getItem(PREVIEW_KEY));
    } catch {
      // Storage blocked: fall back to the first student.
    }
  }, []);

  if (!db || !me) return { db, student: null as Student | null, mode: "loading" as const, setPreview: () => {} };

  if (student) {
    const email = me.email.toLowerCase();
    const own = db.students.find((s) => s.officialEmail?.toLowerCase() === email || s.email?.toLowerCase() === email) ?? null;
    return { db, student: own, mode: "student" as const, setPreview: () => {} };
  }
  const picked = lookup(db.students, previewId) ?? db.students.find((s) => s.status === "ACTIVE") ?? null;
  return {
    db,
    student: picked,
    mode: "preview" as const,
    setPreview: (id: string) => {
      setPreviewId(id);
      try {
        window.sessionStorage.setItem(PREVIEW_KEY, id);
      } catch {
        // Not persisted; the choice still applies on this page.
      }
    },
  };
}

/**
 * Page frame for every portal page: a title, the preview picker for staff,
 * and a clear message when a signed-in account isn't linked to a student.
 */
export function PortalPage({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: (ctx: { db: DemoDb; student: Student }) => ReactNode }) {
  const { db, student, mode, setPreview } = usePortalStudent();
  const pathname = usePathname();
  return (
    <>
      {mode === "preview" && (
        // Staff have one portal link in their sidebar; this switches between the student's pages.
        <nav aria-label="Portal pages" className="mb-3 flex gap-1 overflow-x-auto">
          {PORTAL_NAV.flatMap((s) => s.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium", pathname === item.href ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {mode === "preview" && db && student && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-2.5 text-sm">
          <Icon name="info" className="size-4 text-accent" />
          <span className="text-muted">Staff preview of the student portal, as</span>
          <select
            aria-label="Preview as student"
            value={student.id}
            onChange={(e) => setPreview(e.target.value)}
            className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-sm font-medium"
          >
            {[...db.students]
              .sort((a, b) => a.studentId.localeCompare(b.studentId))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentId} · {s.name}
                </option>
              ))}
          </select>
          <span className="text-xs text-subtle">Students see only their own records after signing in.</span>
        </div>
      )}
      <PageHeader eyebrow={mode === "student" ? "Student portal" : "Student portal · preview"} title={title} description={description} actions={actions} />
      {mode === "loading" ? (
        <DemoLoading />
      ) : !db || !student ? (
        <Card>
          <EmptyState
            icon="user"
            title="Your account isn't linked to a student record"
            description="Ask the Registrar's office to check that your official email matches your student record."
          />
        </Card>
      ) : (
        children({ db, student })
      )}
    </>
  );
}

/** Identity strip at the top of the portal dashboard. */
export function StudentBanner({ db, student }: { db: DemoDb; student: Student }) {
  const program = lookup(db.programs, student.programId);
  const section = lookup(db.sections, student.sectionId);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <Avatar name={student.name} />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{student.name}</p>
        <p className="text-sm text-muted">
          <span className="font-mono">{student.studentId}</span> · {program?.name} · Batch {student.batch}
          {section ? ` · ${section.name}` : ""}
        </p>
      </div>
      <Badge tone={STATUS_TONE[student.status]} dot>
        {statusLabel(student.status)} student
      </Badge>
    </div>
  );
}
