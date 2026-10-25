/**
 * Reset/invite link sessions (#61): /api/auth/session takes only a fresh `recovery`/`invite`
 * session, and /api/auth/password sets a password only within such a session.
 */
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { isFreshLinkSession, LINK_SESSION_SECONDS } from "../src/auth/jwt";
import { cookiesOf, request, withNewUser } from "./helpers";

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** What the reset email's link carries, made through the admin API instead of a mailbox. */
async function recoveryTokens(email: string): Promise<Tokens> {
  const admin = {
    apikey: env.SUPABASE_SECRET_KEY,
    authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    "content-type": "application/json",
  };
  const link = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ type: "recovery", email }),
  });
  expect(link.status).toBe(200);
  const body = await link.json<{ hashed_token?: string; properties?: { hashed_token?: string } }>();
  const tokenHash = body.hashed_token ?? body.properties?.hashed_token;
  expect(tokenHash).toBeTruthy();
  const verified = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
  });
  expect(verified.status).toBe(200);
  const s = await verified.json<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>();
  return { accessToken: s.access_token, refreshToken: s.refresh_token, expiresIn: s.expires_in };
}

/** The tokens of an ordinary password session, read back from its cookies. */
function tokensOf(cookie: string): Tokens {
  const value = (name: string) =>
    cookie
      .split("; ")
      .find((p) => p.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? "";
  return {
    accessToken: value("__Host-ph_at"),
    refreshToken: value("__Host-ph_rt"),
    expiresIn: 3600,
  };
}

describe("isFreshLinkSession", () => {
  const claims = (method: string, age: number) => ({
    sub: "u",
    email: "a@example.test",
    amr: [{ method, timestamp: 1_000_000 - age }],
  });
  it("accepts a reset or invite link within the window only", () => {
    expect(isFreshLinkSession(claims("recovery", 60), 1_000_000)).toBe(true);
    expect(isFreshLinkSession(claims("invite", LINK_SESSION_SECONDS), 1_000_000)).toBe(true);
    expect(isFreshLinkSession(claims("recovery", LINK_SESSION_SECONDS + 1), 1_000_000)).toBe(false);
    expect(isFreshLinkSession(claims("password", 60), 1_000_000)).toBe(false);
    expect(isFreshLinkSession({ ...claims("x", 0), amr: [] }, 1_000_000)).toBe(false);
  });
});

describe("link sessions", () => {
  it("refuses an ordinary session handed over as if it came from a link (login CSRF)", async () => {
    await withNewUser(async (s) => {
      const res = await request("POST", "/api/auth/session", tokensOf(s.cookie));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: "expiredLink" });
      expect(res.headers.getSetCookie()).toEqual([]);
    });
  });

  it("takes a reset-link session, names its account, and lets it set a password", async () => {
    await withNewUser(async (s) => {
      const res = await request("POST", "/api/auth/session", await recoveryTokens(s.email));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, email: s.email });
      const cookie = cookiesOf(res);
      expect(cookie).toContain("__Host-ph_at=");

      const newPassword = `new-${crypto.randomUUID()}`;
      expect(
        (await request("POST", "/api/auth/password", { password: newPassword }, cookie)).status,
      ).toBe(200);
      const signIn = await request("POST", "/api/auth/sign-in", {
        email: s.email,
        password: newPassword,
      });
      expect(signIn.status).toBe(200);
    });
  });

  it("does not let an ordinary session change the password without the old one", async () => {
    await withNewUser(async (s) => {
      const res = await request(
        "POST",
        "/api/auth/password",
        { password: "x".repeat(16) },
        s.cookie,
      );
      expect(res.status).toBe(403);
      // The old password still works.
      const signIn = await request("POST", "/api/auth/sign-in", {
        email: s.email,
        password: s.password,
      });
      expect(signIn.status).toBe(200);
    });
  });
});
