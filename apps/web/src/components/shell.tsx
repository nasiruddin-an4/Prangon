"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Icon } from "./icons";
import { allowed, findItem, INSTITUTION_NAV, isPortalOnly, PLATFORM_NAV, PORTAL_NAV, type NavItem } from "./navigation";
import { Avatar, Badge, buttonStyles, cx, ErrorNote, ToastProvider } from "./ui";

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { loading, needsTenant, can, me, authError } = useAuth();
  const item = findItem(pathname);
  // A Super Admin on an institution page with no institution picked gets the picker.
  const gated = !loading && needsTenant && !!item?.tenant;
  // A page the user's roles don't cover (e.g. typed into the address bar).
  const denied =
    !loading && !!me && !!item && (!allowed(item, can) || (me.isPlatformAdmin && !!item.tenantUsersOnly) || (!me.isPlatformAdmin && item.href.startsWith("/platform")));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The frame and page always render (pages wait for auth inside useApi), so
  // every route still prerenders as a static shell.
  return (
    <ToastProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
        <aside
          className={cx(
            "sidebar-dark fixed inset-y-0 left-0 z-40 flex w-66 flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0 shadow-pop" : "-translate-x-full",
          )}
        >
          <Sidebar />
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />}

        <div className="min-w-0">
          <Topbar onMenu={() => setOpen(true)} title={item && item.href.startsWith("/portal") && me && !isPortalOnly(can, me.isPlatformAdmin) ? `Student portal · ${item.label}` : item?.label} />
          <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-10">{authError ? <ErrorNote message={authError} /> : denied ? <NoAccess /> : gated ? <TenantPicker /> : children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  // Exact owner of the path, so "Dashboard" (/portal) isn't lit on /portal/accounts.
  const active =
    item.href === "/" ? pathname === "/" : findItem(pathname)?.href === item.href || (item.label === "Student portal preview" && pathname.startsWith("/portal/"));
  return (
    <Link
      href={item.href}
      className={cx(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon name={item.icon} className={cx("size-4.5", active ? "text-accent" : "text-subtle group-hover:text-text")} />
      {item.label}
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-subtle uppercase">{children}</p>;
}

function Sidebar() {
  const { me, can, tenant } = useAuth();
  const isPlatform = !!me?.isPlatformAdmin;

  const visible = (item: NavItem) =>
    allowed(item, can) && !(isPlatform && item.tenantUsersOnly) && !(isPlatform && item.href === "/");

  return (
    <>
      <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-indigo-500 text-white">
          <Icon name="graduation" className="size-4.5" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">EduManage</span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {me && isPlatform && (
          <div>
            <SectionTitle>Platform</SectionTitle>
            <div className="space-y-0.5">
              {PLATFORM_NAV.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        )}

        {me && isPlatform && (
          <div className="px-1">
            <SectionTitle>Managing</SectionTitle>
            <TenantSwitcher />
          </div>
        )}

        {me &&
          (isPortalOnly(can, isPlatform) ? PORTAL_NAV : INSTITUTION_NAV).map((section) => {
            const items = section.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={section.title} className={cx(isPlatform && !tenant && "opacity-60")}>
                <SectionTitle>{section.title}</SectionTitle>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>
              </div>
            );
          })}

      </nav>
    </>
  );
}

/** Super Admin: which institution the institution pages act on. */
function TenantSwitcher() {
  const { institutions, tenant, selectTenant } = useAuth();
  return (
    <div className="relative">
      <select
        value={tenant?.id ?? ""}
        onChange={(e) => selectTenant(e.target.value || null)}
        className={cx(
          "h-10 w-full appearance-none rounded-lg border px-3 pr-8 text-sm font-medium",
          tenant ? "border-accent/40 bg-accent-soft text-accent" : "border-dashed border-border-strong bg-surface-2 text-muted",
        )}
        aria-label="Institution to manage"
      >
        <option value="">Choose an institution…</option>
        {institutions.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

function Topbar({ onMenu, title }: { onMenu: () => void; title?: string }) {
  const { me, tenant } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <button onClick={onMenu} className="-ml-1 rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" aria-label="Open menu">
        <Icon name="menu" className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="truncate font-medium text-muted">{tenant?.name ?? (me?.isPlatformAdmin ? "Platform" : "")}</span>
        {title && (
          <>
            <Icon name="chevronRight" className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate font-medium">{title}</span>
          </>
        )}
      </div>
      <UserMenu />
    </header>
  );
}

function UserMenu() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!me) return <span className="size-9 animate-pulse rounded-full bg-surface-3" />;
  const role = me.isPlatformAdmin ? "Super Admin" : me.roles.map((r) => r.name).join(", ");

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-surface-2" aria-expanded={open} aria-label="Account menu">
        <Avatar name={me.fullName} />
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium">{me.fullName}</span>
          <span className="block max-w-40 truncate text-xs text-muted">{role}</span>
        </span>
        <Icon name="chevronDown" className="hidden size-4 text-subtle sm:block" />
      </button>
      {open && (
        <div className="animate-toast absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium">{me.fullName}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
            <div className="mt-2">
              <Badge tone="accent">{role}</Badge>
            </div>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
            <Icon name="logOut" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function NoAccess() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-surface-3 text-muted">
        <Icon name="lock" className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-1.5 text-sm text-muted">Your role doesn&apos;t include this. Ask your institution administrator if you need it.</p>
      <Link href="/" className={cx(buttonStyles("secondary"), "mt-6")}>
        <Icon name="arrowLeft" />
        Back to dashboard
      </Link>
    </div>
  );
}

/** Shown instead of an institution page until a Super Admin picks an institution. */
function TenantPicker() {
  const { institutions, selectTenant } = useAuth();
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="building" className="size-6" />
        </span>
        <h1 className="text-xl font-semibold">Choose an institution to manage</h1>
        <p className="mt-1 text-sm text-muted">You&apos;re signed in as a platform administrator. Campuses, users and settings belong to one institution at a time.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        {institutions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No institutions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {institutions.map((i) => (
              <li key={i.id}>
                <button onClick={() => selectTenant(i.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2">
                  <Avatar name={i.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block font-mono text-xs text-muted">{i.slug}</span>
                  </span>
                  <Badge tone={i.status === "ACTIVE" ? "success" : i.status === "TRIAL" ? "warning" : "danger"} dot>
                    {i.status}
                  </Badge>
                  <Icon name="chevronRight" className="size-4 text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 text-center">
        <Link href="/platform/institutions" className={buttonStyles("ghost")}>
          <Icon name="plus" />
          Create a new institution
        </Link>
      </div>
    </div>
  );
}
