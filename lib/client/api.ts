/**
 * fetch() for our own API routes. Throws ApiError carrying the response body, whose
 * `error` is a code (see lib/i18n/labels.ts errorMessage) — never display text.
 * A network failure becomes `{ error: "network" }` so the UI can say "no connection"
 * instead of a generic failure (common on a farm with patchy signal).
 */
export class ApiError extends Error {
  constructor(public status: number, public body: { error: string; [k: string]: unknown }) {
    super(body.error);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, { error: "network" });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body && typeof body.error === "string" ? body : { error: "server_error" });
  }
  return body as T;
}

/** The error body of anything thrown by api() (or a generic one). */
export function errorBody(err: unknown): { error: string; [k: string]: unknown } {
  return err instanceof ApiError ? err.body : { error: "server_error" };
}
