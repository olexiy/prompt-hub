import { env, exports } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, inject, it } from "vitest";

const ORIGIN = "http://localhost";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return exports.default.fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      // A fresh client IP per call keeps these tests clear of the auth rate limit.
      "cf-connecting-ip": `198.51.100.${String(Math.floor(Math.random() * 250))}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** "name=value" pairs from Set-Cookie headers, ready for a Cookie header. */
function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signIn(): Promise<string> {
  const { email, password } = inject("testUser");
  const res = await post("/api/auth/sign-in", { email, password });
  expect(res.status).toBe(200);
  return cookiesFrom(res);
}

const me = (cookie?: string) =>
  exports.default.fetch(`${ORIGIN}/api/me`, { headers: cookie ? { cookie } : {} });

describe("sign-in", () => {
  it("sets the session only in __Host- HttpOnly Secure SameSite=Lax cookies", async () => {
    const { email, password } = inject("testUser");
    const res = await post("/api/auth/sign-in", { email, password });
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("eyJ"); // no token in the body
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const c of cookies) {
      expect(c).toMatch(/^__Host-ph_(at|rt)=/);
      expect(c).toContain("HttpOnly");
      expect(c).toContain("Secure");
      expect(c).toContain("SameSite=Lax");
      expect(c).toContain("Path=/");
      expect(c).not.toMatch(/Domain=/i);
    }
  });

  it("rejects a wrong password with a plain message", async () => {
    const { email } = inject("testUser");
    const res = await post("/api/auth/sign-in", { email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Email or password is wrong" });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("rejects malformed input", async () => {
    expect((await post("/api/auth/sign-in", { email: "not-an-email", password: "x" })).status).toBe(
      400,
    );
  });

  it("creates the app_user on first request and returns it from /api/me", async () => {
    const res = await me(await signIn());
    expect(res.status).toBe(200);
    const body: { handle: string; locale: string } = await res.json();
    expect(body.handle).toMatch(/^test-\d+$/);
    expect(body.locale).toBe("en");
  });

  it("refreshes and signs out", async () => {
    const cookie = await signIn();
    const refreshed = await post("/api/auth/refresh", {}, { cookie });
    expect(refreshed.status).toBe(200);
    expect((await me(cookiesFrom(refreshed))).status).toBe(200);

    const out = await post("/api/auth/sign-out", {}, { cookie: cookiesFrom(refreshed) });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie().every((c) => /Max-Age=0/.test(c))).toBe(true);
  });
});

describe("protected API", () => {
  it("401 without a session", async () => {
    expect((await me()).status).toBe(401);
  });

  it("401 for a token signed with someone else's key", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const jwk = await exportJWK(publicKey);
    const forged = await new SignJWT({ email: "attacker@example.test", role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "forged", jwk })
      .setSubject(crypto.randomUUID())
      .setIssuer(`${env.SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
    expect((await me(`__Host-ph_at=${forged}`)).status).toBe(401);
  });

  it("401 for an unsigned token (alg none)", async () => {
    const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
    const none = `${part({ alg: "none", typ: "JWT" })}.${part({ sub: crypto.randomUUID(), email: "x@example.test", aud: "authenticated", iss: `${env.SUPABASE_URL}/auth/v1`, exp: 9_999_999_999 })}.`;
    expect((await me(`__Host-ph_at=${none}`)).status).toBe(401);
  });

  it("401 for an expired token from the real issuer", async () => {
    // A token whose signature is fine but whose exp is in the past cannot be minted without
    // the server key; tamper the exp of a real token instead — the signature then fails too.
    const cookie = await signIn();
    const token = /__Host-ph_at=([^;]+)/.exec(cookie)?.[1] ?? "";
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(atob((p ?? "").replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
    payload.exp = 1;
    const tampered = `${h ?? ""}.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.${s ?? ""}`;
    expect((await me(`__Host-ph_at=${tampered}`)).status).toBe(401);
  });
});

describe("sign-up and CSRF", () => {
  it("sign-up is closed at Supabase", async () => {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        email: `new-${String(Date.now())}@example.test`,
        password: "long-enough-password",
      }),
    });
    expect(res.ok).toBe(false);
  });

  it("refuses state-changing requests from another origin or without JSON", async () => {
    const { email, password } = inject("testUser");
    expect(
      (await post("/api/auth/sign-in", { email, password }, { origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    const form = await exports.default.fetch(`${ORIGIN}/api/auth/sign-in`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    });
    expect(form.status).toBe(415);
  });
});

describe("GET /api/auth/session", () => {
  const session = (cookie?: string) =>
    exports.default.fetch(`${ORIGIN}/api/auth/session`, { headers: cookie ? { cookie } : {} });

  it("answers 200 with no user when signed out", async () => {
    const res = await session();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("returns the user when signed in", async () => {
    const body: { user: { handle: string } | null } = await (await session(await signIn())).json();
    expect(body.user?.handle).toMatch(/^test-\d+$/);
  });

  it("renews an expired access token from the refresh cookie", async () => {
    const refreshOnly = (await signIn())
      .split("; ")
      .filter((c) => c.startsWith("__Host-ph_rt="))
      .join("; ");
    const res = await session(refreshOnly);
    const body: { user: { handle: string } | null } = await res.json();
    expect(body.user).not.toBeNull();
    expect(res.headers.getSetCookie().some((c) => c.startsWith("__Host-ph_at="))).toBe(true);
  });
});
