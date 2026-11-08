"use client";

/** Thrown for any non-2xx API response, with the server's message(s). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const TENANT_KEY = "edumanage.selectedInstitution";

/** Super Admins pick the institution they act on; sent as X-Institution-Id. */
export const selectedInstitution = {
  get(): string | null {
    try {
      return localStorage.getItem(TENANT_KEY);
    } catch {
      return null;
    }
  },
  set(id: string | null) {
    try {
      if (id) localStorage.setItem(TENANT_KEY, id);
      else localStorage.removeItem(TENANT_KEY);
    } catch {
      /* storage unavailable: selection lasts for this page only */
    }
  },
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const tenant = selectedInstitution.get();
  if (tenant && !headers.has("x-institution-id")) headers.set("x-institution-id", tenant);

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      response.status === 429
        ? "Too many requests. Please wait a minute and try again."
        : Array.isArray(body.message)
          ? body.message.join("\n")
          : body.message ?? response.statusText;
    throw new ApiError(response.status, message, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
