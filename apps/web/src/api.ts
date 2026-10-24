/** Minimal JSON client for our own API; the session travels in HttpOnly cookies automatically. */
import type { Locale, Theme } from "@prompt-hub/core";
import { buildHeaders, isStale, noteBuild } from "./build";
import { apiErrorMessage } from "./i18n";

/** A failed API call; `message` is already in the user's language when the code is known (#36). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  noteBuild(res);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const code = body.code ?? "generic";
    throw new ApiError(
      res.status,
      apiErrorMessage(code, body.error ?? "Something went wrong"),
      code,
    );
  }
  return body;
}

export async function get<T>(path: string): Promise<T> {
  return handle<T>(await fetch(path, { credentials: "same-origin", headers: buildHeaders() }));
}

export async function post<T = { ok: true }>(path: string, body: unknown = {}): Promise<T> {
  return send<T>("POST", path, body);
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  return send<T>("PATCH", path, body);
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  return send<T>("PUT", path, body);
}

export async function del(path: string): Promise<void> {
  refuseIfStale();
  const res = await fetch(path, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...buildHeaders() },
  });
  if (!res.ok) await handle(res);
}

/** An old tab sends no writes: what it would send may not match the new API (#73). */
function refuseIfStale() {
  if (isStale()) {
    throw new ApiError(
      409,
      apiErrorMessage("staleClient", "A new version is available"),
      "staleClient",
    );
  }
}

async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  refuseIfStale();
  return handle<T>(
    await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...buildHeaders() },
      body: JSON.stringify(body),
    }),
  );
}

export interface Me {
  id: string;
  handle: string;
  displayName: string;
  locale: Locale;
  theme: Theme;
}
