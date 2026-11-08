"use client";

/**
 * Browser-storage backend for the Phase 2–5 modules, one database per
 * institution. Pages read with `useDemo()` and write with `update(draft => …)`;
 * every change is saved to localStorage and re-renders every subscriber
 * (including other tabs). When the API endpoints exist, this file is the only
 * one that changes: `update` becomes API calls.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "../auth";
import { todayDhaka } from "./logic";
import { createDemoDb, DEMO_VERSION, migrateDemoDb } from "./seed";
import type { DemoDb } from "./types";

const PREFIX = "edumanage:demo:";
const keyFor = (tenantId: string) => `${PREFIX}${tenantId}`;

const cache = new Map<string, DemoDb>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(tenantId: string): DemoDb {
  const cached = cache.get(tenantId);
  if (cached) return cached;
  let db: DemoDb | null = null;
  try {
    const raw = window.localStorage.getItem(keyFor(tenantId));
    if (raw) {
      const parsed = migrateDemoDb(JSON.parse(raw) as DemoDb, todayDhaka());
      if (parsed.version === DEMO_VERSION) {
        db = parsed;
        save(tenantId, db);
      }
    }
  } catch {
    // Unreadable or blocked storage: fall back to fresh demo data in memory.
  }
  if (!db) {
    db = createDemoDb(todayDhaka());
    save(tenantId, db);
  }
  cache.set(tenantId, db);
  return db;
}

function save(tenantId: string, db: DemoDb) {
  try {
    window.localStorage.setItem(keyFor(tenantId), JSON.stringify(db));
  } catch {
    // Quota or private mode: the change still lives in memory for this tab.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) {
      cache.delete(e.key.slice(PREFIX.length));
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface DemoApi {
  /** Null while signing in, or before an institution is chosen. */
  db: DemoDb | null;
  /** Apply a change. The draft is a deep copy, so mutate it freely; throw to abort. */
  update: (change: (draft: DemoDb) => void) => void;
  /** Throw away local changes and reload the demo data. */
  reset: () => void;
  /** Who is acting, for "taken by" / "collected by" fields. */
  actor: string;
}

export function useDemo(): DemoApi {
  const { tenant, me } = useAuth();
  const tenantId = tenant?.id ?? null;
  const db = useSyncExternalStore(
    subscribe,
    () => (tenantId ? load(tenantId) : null),
    () => null,
  );

  const update = useCallback(
    (change: (draft: DemoDb) => void) => {
      if (!tenantId) return;
      const draft = structuredClone(load(tenantId));
      change(draft);
      cache.set(tenantId, draft);
      save(tenantId, draft);
      emit();
    },
    [tenantId],
  );

  const reset = useCallback(() => {
    if (!tenantId) return;
    const fresh = createDemoDb(todayDhaka());
    cache.set(tenantId, fresh);
    save(tenantId, fresh);
    emit();
  }, [tenantId]);

  return { db, update, reset, actor: me?.fullName ?? "Unknown" };
}
