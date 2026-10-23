import { env, exports } from "cloudflare:workers";
import { describe, expect, inject, it } from "vitest";

const ORIGIN = "http://localhost";

function request(method: string, path: string, body?: unknown, cookie?: string) {
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

async function signIn(): Promise<string> {
  const res = await request("POST", "/api/auth/sign-in", inject("testUser"));
  expect(res.status).toBe(200);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

interface Me {
  handle: string;
  locale: string;
  theme: string;
}

describe("PATCH /api/me", () => {
  it("saves language and theme and returns them from GET /api/me", async () => {
    const cookie = await signIn();
    const res = await request("PATCH", "/api/me", { locale: "de", theme: "dark" }, cookie);
    expect(res.status).toBe(200);
    expect(await res.json<Me>()).toMatchObject({ locale: "de", theme: "dark" });

    const me = await (await request("GET", "/api/me", undefined, cookie)).json<Me>();
    expect(me).toMatchObject({ locale: "de", theme: "dark" });

    // Partial update keeps the other field.
    await request("PATCH", "/api/me", { locale: "ru" }, cookie);
    expect(await (await request("GET", "/api/me", undefined, cookie)).json<Me>()).toMatchObject({
      locale: "ru",
      theme: "dark",
    });
    await request("PATCH", "/api/me", { locale: "en", theme: "system" }, cookie);
  });

  it.each([
    [{ locale: "fr" }],
    [{ theme: "auto" }],
    [{}],
    [{ handle: "someone-else" }],
    [{ locale: "en", plan: "PRO" }],
  ])("rejects %j with 400", async (body) => {
    const cookie = await signIn();
    const res = await request("PATCH", "/api/me", body, cookie);
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("Unknown language or theme");
  });

  it("401 without a session", async () => {
    expect((await request("PATCH", "/api/me", { locale: "de" })).status).toBe(401);
  });
});

describe("first request of a new user", () => {
  it("parallel first requests create one app_user without errors", async () => {
    // A brand-new Supabase user, so the requests below are its very first ones.
    const admin = {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    };
    const email = `race-${crypto.randomUUID()}@example.test`;
    const password = `pw-${crypto.randomUUID()}`;
    const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    expect(created.status).toBe(200);
    const { id } = await created.json<{ id: string }>();
    try {
      const res = await request("POST", "/api/auth/sign-in", { email, password });
      const cookie = res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const results = await Promise.all(
        Array.from({ length: 5 }, () => request("GET", "/api/me", undefined, cookie)),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      const handles = await Promise.all(results.map((r) => r.json<Me>().then((m) => m.handle)));
      expect(new Set(handles).size).toBe(1);
    } finally {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: admin,
      });
    }
  });
});
