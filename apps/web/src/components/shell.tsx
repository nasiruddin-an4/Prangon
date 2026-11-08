"use client";

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Icon } from "./icons";
import { allowed, findItem, INSTITUTION_NAV, isPortalOnly, PLATFORM_NAV, PORTAL_NAV, type NavItem } from "./navigation";
import { Avatar, Badge, buttonStyles, cx, ErrorNote, ToastProvider } from "./ui";

// ── Sidebar preferences (per browser) ────────────────────────────────────

const PREFS_KEY = "prangon:sidebar";
interface SidebarPrefs {
  /** Desktop only: icons-only rail instead of the full sidebar. */
  collapsed: boolean;
  /** Titles of folded sections. */
  closed: string[];
}

function useSidebarPrefs() {
  const [prefs, setPrefs] = useState<SidebarPrefs>({ collapsed: false, closed: [] });
  // Read after mount so the server-rendered shell and first client render match.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ collapsed: false, closed: [], ...(JSON.parse(raw) as Partial<SidebarPrefs>) });
    } catch {
      // Blocked or corrupt storage: keep the defaults.
    }
  }, []);
  const update = useCallback((change: (p: SidebarPrefs) => SidebarPrefs) => {
    setPrefs((current) => {
      const next = change(current);
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Not persisted; still applies until reload.
      }
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefs, updatePrefs] = useSidebarPrefs();
  const pathname = usePathname();
  const { loading, needsTenant, can, me, authError } = useAuth();
  const item = findItem(pathname);
  // A Super Admin on an institution page with no institution picked gets the picker.
  const gated = !loading && needsTenant && !!item?.tenant;
  // A page the user's roles don't cover (e.g. typed into the address bar).
  const denied =
    !loading && !!me && !!item && (!allowed(item, can) || (me.isPlatformAdmin && !!item.tenantUsersOnly) || (!me.isPlatformAdmin && item.href.startsWith("/platform")));
  const rail = prefs.collapsed;
  const toggleRail = useCallback(() => updatePrefs((p) => ({ ...p, collapsed: !p.collapsed })), [updatePrefs]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // Ctrl+B / ⌘B collapses or expands the sidebar (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "b" && !isTyping(e.target)) {
        e.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  // The frame and page always render (pages wait for auth inside useApi), so
  // every route still prerenders as a static shell.
  return (
    <ToastProvider>
      <div className={cx("min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-200", rail ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[264px_1fr]")}>
        <aside
          className={cx(
            "sidebar-dark fixed inset-y-0 left-0 z-40 flex w-66 flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            rail && "lg:w-[76px]",
            open ? "translate-x-0 shadow-pop" : "-translate-x-full",
          )}
        >
          <Sidebar rail={rail} closed={prefs.closed} updatePrefs={updatePrefs} onToggleRail={toggleRail} />
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />}

        <div className="min-w-0">
          <Topbar onMenu={() => setOpen(true)} rail={rail} onToggleRail={toggleRail} title={item && item.href.startsWith("/portal") && me && !isPortalOnly(can, me.isPlatformAdmin) ? `Student portal · ${item.label}` : item?.label} />
          <main className={cx("mx-auto px-4 py-7 sm:px-6 lg:px-10", rail ? "max-w-7xl" : "max-w-6xl")}>{authError ? <ErrorNote message={authError} /> : denied ? <NoAccess /> : gated ? <TenantPicker /> : children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

type Tip = (label: string | null, el?: HTMLElement) => void;

function useIsActive() {
  const pathname = usePathname();
  // Exact owner of the path, so "Dashboard" (/portal) isn't lit on /portal/accounts.
  return (item: NavItem) =>
    item.href === "/" ? pathname === "/" : findItem(pathname)?.href === item.href || (item.label === "Student portal preview" && pathname.startsWith("/portal/"));
}

/**
 * A sidebar link. In the desktop rail only the icon shows; the label appears
 * as a tooltip on hover or keyboard focus. In the mobile drawer labels always show.
 */
function NavLink({ item, rail, onTip }: { item: NavItem; rail: boolean; onTip: Tip }) {
  const active = useIsActive()(item);
  const show = (e: { currentTarget: HTMLElement }) => rail && onTip(item.label, e.currentTarget);
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={() => onTip(null)}
      onBlur={() => onTip(null)}
      className={cx(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        rail && "lg:justify-center lg:px-0",
        active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon name={item.icon} className={cx("size-4.5 shrink-0", active ? "text-accent" : "text-subtle group-hover:text-text")} />
      <span className={cx("truncate", rail && "lg:hidden")}>{item.label}</span>
    </Link>
  );
}

/** Section title that folds its links; shows how many are hidden while folded. */
function SectionToggle({ title, closed, count, rail, onToggle }: { title: string; closed: boolean; count: number; rail: boolean; onToggle: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!closed}
        className={cx(
          "mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold tracking-wider text-subtle uppercase transition-colors hover:text-text",
          rail && "lg:hidden",
        )}
      >
        <span>{title}</span>
        <span className="flex items-center gap-1.5">
          {closed && <span className="rounded bg-surface-2 px-1.5 text-[10px] font-medium tabular-nums">{count}</span>}
          <Icon name="chevronDown" className={cx("size-3.5 transition-transform", closed && "-rotate-90")} />
        </span>
      </button>
      {rail && <div className="mx-3 mb-2 hidden h-px bg-border lg:block" aria-hidden="true" />}
    </>
  );
}

function Sidebar({ rail, closed, updatePrefs, onToggleRail }: { rail: boolean; closed: string[]; updatePrefs: (change: (p: SidebarPrefs) => SidebarPrefs) => void; onToggleRail: () => void }) {
  const { me, can, tenant } = useAuth();
  const pathname = usePathname();
  const isActive = useIsActive();
  const isPlatform = !!me?.isPlatformAdmin;
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const onTip: Tip = (label, el) => {
    // Tooltips only for the desktop rail; the mobile drawer shows labels.
    if (!label || !el || !window.matchMedia("(min-width: 1024px)").matches) return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };

  const visible = (item: NavItem) =>
    allowed(item, can) && !(isPlatform && item.tenantUsersOnly) && !(isPlatform && item.href === "/");
  const sections = me ? (isPortalOnly(can, isPlatform) ? PORTAL_NAV : INSTITUTION_NAV) : [];
  const toggleSection = (title: string) =>
    updatePrefs((p) => ({ ...p, closed: p.closed.includes(title) ? p.closed.filter((t) => t !== title) : [...p.closed, title] }));

  // Opening a page always unfolds its section, so the current page is never hidden.
  const activeSection = sections.find((sec) => sec.items.some(isActive))?.title;
  useEffect(() => {
    if (activeSection && closed.includes(activeSection)) updatePrefs((p) => ({ ...p, closed: p.closed.filter((t) => t !== activeSection) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on navigation
  }, [pathname, activeSection]);
  useEffect(() => setTip(null), [pathname, rail]);


  return (
    <>
      <Link
        href="/"
        aria-label={`${BRAND.name} home`}
        className={cx("flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5", rail && "lg:justify-center lg:px-0")}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white">
          <Icon name="graduation" className="size-4.5" />
        </span>
        <span className={cx("leading-tight", rail && "lg:hidden")}>
          <span className="block text-[15px] font-semibold tracking-tight">{BRAND.name}</span>
          <span className="block text-[11px] text-subtle">{BRAND.bangla}</span>
        </span>
      </Link>

      <nav className={cx("flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-3 py-5", rail && "lg:space-y-1 lg:px-3")} onScroll={() => setTip(null)}>
        {me && isPlatform && (
          <div>
            <SectionToggle title="Platform" closed={closed.includes("Platform")} count={PLATFORM_NAV.length} rail={rail} onToggle={() => toggleSection("Platform")} />
            <div className={cx("space-y-0.5", closed.includes("Platform") && (rail ? "max-lg:hidden" : "hidden"))}>
              {PLATFORM_NAV.map((item) => (
                <NavLink key={item.href} item={item} rail={rail} onTip={onTip} />
              ))}
            </div>
          </div>
        )}

        {me && isPlatform && (
          <div className="px-1">
            <p className={cx("mb-1 px-2 text-[11px] font-semibold tracking-wider text-subtle uppercase", rail && "lg:hidden")}>Managing</p>
            <div className={cx(rail && "lg:hidden")}>
              <TenantSwitcher />
            </div>
            {rail && (
              <button
                type="button"
                onClick={onToggleRail}
                onMouseEnter={(e) => onTip(tenant ? `Managing: ${tenant.name}` : "Choose an institution", e.currentTarget)}
                onMouseLeave={() => onTip(null)}
                aria-label="Expand the sidebar to choose an institution"
                className={cx("my-1 hidden w-full place-items-center rounded-lg py-2 lg:grid", tenant ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2")}
              >
                <Icon name="building" className="size-4.5" />
              </button>
            )}
          </div>
        )}

        {sections.map((section) => {
          const items = section.items.filter(visible);
          if (!items.length) return null;
          const isClosed = closed.includes(section.title);
          return (
            <div key={section.title} className={cx(isPlatform && !tenant && "opacity-60")}>
              <SectionToggle title={section.title} closed={isClosed} count={items.length} rail={rail} onToggle={() => toggleSection(section.title)} />
              {/* In the rail every icon stays reachable, so folding applies only to the full sidebar. */}
              <div className={cx("space-y-0.5", isClosed && (rail ? "max-lg:hidden" : "hidden"))}>
                {items.map((item) => (
                  <NavLink key={item.href} item={item} rail={rail} onTip={onTip} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {rail && tip && (
        <div role="tooltip" className="pointer-events-none fixed left-[84px] z-50 hidden -translate-y-1/2 rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-pop ring-1 ring-white/10 lg:block" style={{ top: tip.top }}>
          {tip.label}
        </div>
      )}
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

function Topbar({ onMenu, title, rail, onToggleRail }: { onMenu: () => void; title?: string; rail: boolean; onToggleRail: () => void }) {
  const { me, tenant } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      {/* One icon button: opens the drawer on phones, collapses/expands the sidebar on desktop (also Ctrl+B / ⌘B). */}
      <button onClick={onMenu} className="-ml-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text lg:hidden" aria-label="Open menu">
        <Icon name="menu" className="size-5" />
      </button>
      <button
        onClick={onToggleRail}
        className="-ml-2 hidden rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text lg:block"
        aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!rail}
        aria-keyshortcuts="Control+B Meta+B"
        title={`${rail ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
      >
        <Icon name={rail ? "panelOpen" : "panelClose"} className="size-5" />
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
