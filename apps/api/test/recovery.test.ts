/**
 * Reset/invite links (#61): /api/auth/link names the account of a fresh email-link session
 * without signing in; /api/auth/password sets the password with that session, then signs in.
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
  it("accepts an email-link session within the window only", () => {
    expect(isFreshLinkSession(claims("otp", 60), 1_000_000)).toBe(true);
    expect(isFreshLinkSession(claims("recovery", 60), 1_000_000)).toBe(true);
    expect(isFreshLinkSession(claims("invite", LINK_SESSION_SECONDS), 1_000_000)).toBe(true);
    expect(isFreshLinkSession(claims("recovery", LINK_SESSION_SECONDS + 1), 1_000_000)).toBe(false);
    expect(isFreshLinkSession(claims("password", 60), 1_000_000)).toBe(false);
    expect(isFreshLinkSession({ ...claims("x", 0), amr: [] }, 1_000_000)).toBe(false);
  });
});

describe("link sessions", () => {
  it("refuses an ordinary session presented as a link (login CSRF)", async () => {
    await withNewUser(async (s) => {
      const res = await request("POST", "/api/auth/link", tokensOf(s.cookie));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: "expiredLink" });
      const pw = await request("POST", "/api/auth/password", {
        password: "x".repeat(16),
        link: tokensOf(s.cookie),
      });
      expect(pw.status).toBe(401);
      expect(pw.headers.getSetCookie()).toEqual([]);
    });
  });

  it("names a reset link's account without signing anyone in", async () => {
    await withNewUser(async (s) => {
      const res = await request("POST", "/api/auth/link", await recoveryTokens(s.email));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ email: s.email });
      expect(res.headers.getSetCookie()).toEqual([]);
    });
  });

  it("sets the new password with the link, then signs in", async () => {
    await withNewUser(async (s) => {
      const newPassword = `new-${crypto.randomUUID()}`;
      const res = await request("POST", "/api/auth/password", {
        password: newPassword,
        link: await recoveryTokens(s.email),
      });
      expect(res.status).toBe(200);
      const me = await request("GET", "/api/me", undefined, cookiesOf(res));
      expect(me.status).toBe(200);
      const signIn = await request("POST", "/api/auth/sign-in", {
        email: s.email,
        password: newPassword,
      });
      expect(signIn.status).toBe(200);
    });
  });

  it("an ordinary session cannot change the password (no link in the body)", async () => {
    await withNewUser(async (s) => {
      const res = await request(
        "POST",
        "/api/auth/password",
        { password: "x".repeat(16) },
        s.cookie,
      );
      expect(res.status).toBe(400);
      const signIn = await request("POST", "/api/auth/sign-in", {
        email: s.email,
        password: s.password,
      });
      expect(signIn.status).toBe(200);
    });
  });
});
