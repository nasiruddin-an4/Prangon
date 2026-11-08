"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { useAuth } from "./auth";

/**
 * Minimal data hook: loads once the signed-in user (and, for a Super Admin,
 * the selected institution) is known, again when `path` or the institution
 * changes, and on `reload()`. Pass `null` to skip.
 */
export function useApi<T>(path: string | null) {
  const { loading: authLoading, tenant } = useAuth();
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);
  const tenantId = tenant?.id ?? null;

  useEffect(() => {
    if (path === null || authLoading) return;
    let cancelled = false;
    setLoading(true);
    api<T>(path)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e : new ApiError(0, String(e))))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, version, authLoading, tenantId]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading: loading || authLoading, reload };
}
