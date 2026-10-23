/** Minimal JSON client for our own API; the session travels in HttpOnly cookies automatically. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Something went wrong");
  return body;
}

export async function get<T>(path: string): Promise<T> {
  return handle<T>(await fetch(path, { credentials: "same-origin" }));
}

export async function post<T = { ok: true }>(path: string, body: unknown = {}): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export interface Me {
  id: string;
  handle: string;
  displayName: string;
  locale: string;
  theme: string;
}
