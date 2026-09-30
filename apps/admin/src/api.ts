import { authHeaders } from "./auth";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}/admin${path}`, {
    method: init.method ?? "GET",
    headers: { ...(await authHeaders()), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
  return data as T;
}
