"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me, Paginated, Permission } from "@edumanage/shared";
import { api, ApiError, selectedInstitution } from "./api";

export interface InstitutionSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: string;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  /** Why the signed-in user couldn't be loaded (not a sign-out). */
  authError: string | null;
  /** The institution the tenant pages act on (own one, or the Super Admin's pick). */
  tenant: InstitutionSummary | null;
  /** Super Admin only: every institution, for the switcher. */
  institutions: InstitutionSummary[];
  /** True when a Super Admin hasn't picked an institution yet. */
  needsTenant: boolean;
  selectTenant: (id: string | null) => void;
  can: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const current = await api<Me>("/auth/me");
      if (current.isPlatformAdmin) {
        const list = await api<Paginated<InstitutionSummary>>("/platform/institutions?pageSize=100");
        setInstitutions(list.items);
        // A saved pick can point at an institution that was since deleted.
        const saved = selectedInstitution.get();
        const valid = saved && list.items.some((i) => i.id === saved) ? saved : null;
        if (!valid) selectedInstitution.set(null);
        setSelectedId(valid);
      } else {
        selectedInstitution.set(null);
      }
      setMe(current);
    } catch (e) {
      // Only a rejected session means "sign in again"; anything else (rate
      // limit, network) is shown in place instead of bouncing to the login page.
      if (e instanceof ApiError && e.status === 401) {
        window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setAuthError(e instanceof ApiError ? e.message : "Could not reach the server. Check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(() => {
    const tenant = me?.isPlatformAdmin
      ? institutions.find((i) => i.id === selectedId) ?? null
      : me?.institution
        ? { ...me.institution, status: "ACTIVE" }
        : null;
    return {
      me,
      loading,
      authError,
      tenant,
      institutions,
      needsTenant: !!me?.isPlatformAdmin && !tenant,
      selectTenant: (id) => {
        selectedInstitution.set(id);
        setSelectedId(id);
      },
      // UI hint only: the API enforces every permission again.
      can: (permission) => !!me && (me.isPlatformAdmin || me.permissions.includes(permission)),
      refresh,
      signOut: async () => {
        await api("/auth/sign-out", { method: "POST" }).catch(() => undefined);
        selectedInstitution.set(null);
        window.location.href = "/login";
      },
    };
  }, [me, loading, authError, institutions, selectedId, refresh]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
