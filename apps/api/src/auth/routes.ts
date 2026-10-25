/** /api/auth/* — sign-in, sign-out, refresh and password reset. Sign-up does not exist. */
import { errorBody } from "@prompt-hub/core";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app-env";
import { clearSession, readSession, setSession } from "./cookies";
import { createDb } from "@prompt-hub/db";
import { isFreshLinkSession, verifyAccessToken } from "./jwt";
import { ensureAppUser } from "./users";
import { log } from "../security/log";
import { clientIp, rateLimit } from "../security/rate-limit";
import { parseJson } from "../security/validate";
import {
  AuthError,
  refreshSession,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from "./supabase";

const credentials = z.object({ email: z.email().max(320), password: z.string().min(1).max(200) });
const resetRequest = z.object({ email: z.email().max(320) });
const recoverySession = z.object({
  accessToken: z.string().min(1).max(4096),
  refreshToken: z.string().min(1).max(512),
  expiresIn: z.number().int().positive().max(86_400),
});
const newPassword = z.object({ password: z.string().min(12).max(200), link: recoverySession });

export const authRoutes = new Hono<AppEnv>()
  .get("/session", async (c) => {
    // Always 200: the app asks "who am I?" on every load, and signed-out is a normal answer.
    // An expired access token is renewed here with the refresh cookie, server-side.
    const { access, refresh } = readSession(c);
    let claims = await verifyAccessToken(access, c.env.SUPABASE_URL);
    if (!claims && refresh) {
      try {
        const renewed = await refreshSession(c.env, refresh);
        setSession(c, renewed);
        claims = await verifyAccessToken(renewed.accessToken, c.env.SUPABASE_URL);
      } catch {
        clearSession(c);
      }
    }
    if (!claims) return c.json({ user: null });
    const { id, handle, displayName, locale, theme } = await ensureAppUser(
      createDb(c.env.HYPERDRIVE.connectionString).db,
      claims,
    );
    return c.json({ user: { id, handle, displayName, locale, theme } });
  })
  .post("/sign-in", rateLimit("AUTH_LIMITER"), async (c) => {
    const body = await parseJson(c, credentials, "enterCredentials");
    try {
      const tokens = await signInWithPassword(c.env, body.email, body.password);
      setSession(c, tokens);
      const claims = await verifyAccessToken(tokens.accessToken, c.env.SUPABASE_URL);
      log.info("auth_sign_in", { user: claims?.sub, ip: clientIp(c.req) });
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof AuthError && e.status === 401) {
        // Security event (ASVS V16); the address itself is not logged.
        log.warn("auth_sign_in_failed", { ip: clientIp(c.req) });
        return c.json(errorBody("badCredentials"), 401);
      }
      throw e;
    }
  })
  .post("/sign-out", async (c) => {
    const { access } = readSession(c);
    if (access) await signOut(c.env, access);
    clearSession(c);
    return c.json({ ok: true });
  })
  .post("/refresh", async (c) => {
    const { refresh } = readSession(c);
    if (!refresh) return c.json(errorBody("unauthorized"), 401);
    try {
      setSession(c, await refreshSession(c.env, refresh));
      return c.json({ ok: true });
    } catch {
      clearSession(c);
      return c.json(errorBody("unauthorized"), 401);
    }
  })
  .post("/reset", rateLimit("AUTH_LIMITER"), async (c) => {
    const body = await parseJson(c, resetRequest, "enterEmail");
    const redirectTo = `${new URL(c.req.url).origin}/auth/callback`;
    await requestPasswordReset(c.env, body.email, redirectTo);
    // Same answer for known and unknown addresses (no account enumeration).
    return c.json({ ok: true });
  })
  .post("/link", rateLimit("AUTH_LIMITER"), async (c) => {
    // The reset (or invite) link lands on /auth/callback with tokens in the URL fragment. The
    // page asks here whose link it is and shows the address; no session is set yet (#61).
    const body = await parseJson(c, recoverySession, "invalidLink");
    const claims = await linkClaims(c, body.accessToken);
    if (!claims) return c.json(errorBody("expiredLink"), 401);
    return c.json({ email: claims.email });
  })
  .post("/password", rateLimit("AUTH_LIMITER"), async (c) => {
    // Sets the new password with the link's session and only then signs the visitor in (#61).
    // A link someone else made for their own account therefore never signs anybody in by just
    // being opened (login CSRF), and an ordinary session cannot change the password at all.
    const body = await parseJson(c, newPassword, "weakPassword");
    const claims = await linkClaims(c, body.link.accessToken);
    if (!claims) return c.json(errorBody("expiredLink"), 401);
    await updatePassword(c.env, body.link.accessToken, body.password);
    setSession(c, body.link);
    log.info("auth_password_changed", { user: claims.sub, ip: clientIp(c.req) });
    return c.json({ ok: true });
  });

/** Claims of a fresh email-link session, or null (logged as a refused link). */
async function linkClaims(c: Context<AppEnv>, accessToken: string) {
  const claims = await verifyAccessToken(accessToken, c.env.SUPABASE_URL);
  if (claims && isFreshLinkSession(claims)) return claims;
  log.warn("auth_link_refused", { ip: clientIp(c.req), user: claims?.sub });
  return null;
}
