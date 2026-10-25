/** Shared helpers for API tests in the Workers runtime. */
import { env, exports } from "cloudflare:workers";
import { expect } from "vitest";

export const ORIGIN = "http://localhost";

/**
 * A request as the web app sends it: same origin, JSON, and a fresh fake client IP per call so
 * the per-IP rate limits never trip across tests.
 */
export function request(method: string, path: string, body?: unknown, cookie?: string) {
  return exports.default.fetch(`${ORIGIN}${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "cf-connecting-ip": `198.51.100.${String(Math.floor(Math.random() * 250))}`,
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

export interface TestSession {
  cookie: string;
  handle: string;
  email: string;
  password: string;
}

/**
 * Runs `test` with a brand-new signed-in Supabase user (deleted afterwards). Use it for tests that
 * change account state or need a user of their own; the suite's shared user keeps its defaults.
 */
export async function withNewUser(
  test: (session: TestSession) => Promise<void>,
  /** false: leave the user's first API request to the test (handle is then ""). */
  { loadHandle = true }: { loadHandle?: boolean } = {},
): Promise<void> {
  const admin = {
    apikey: env.SUPABASE_SECRET_KEY,
    authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  };
  const email = `api-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  expect(created.status).toBe(200);
  const { id } = await created.json<{ id: string }>();
  try {
    const signIn = await request("POST", "/api/auth/sign-in", { email, password });
    expect(signIn.status).toBe(200);
    const cookie = cookiesOf(signIn);
    let handle = "";
    if (loadHandle) {
      const me = await request("GET", "/api/me", undefined, cookie);
      handle = (await me.json<{ handle: string }>()).handle;
    }
    await test({ cookie, handle, email, password });
  } finally {
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: admin,
    });
  }
}
