/** /api/auth/* — sign-in, sign-out, refresh and password reset. Sign-up does not exist. */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app-env";
import { clearSession, readSession, setSession } from "./cookies";
import { createDb } from "@prompt-hub/db";
import { verifyAccessToken } from "./jwt";
import { ensureAppUser } from "./users";
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
const newPassword = z.object({ password: z.string().min(12).max(200) });

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
  .post("/sign-in", async (c) => {
    const body = credentials.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter an email and a password" }, 400);
    try {
      setSession(c, await signInWithPassword(c.env, body.data.email, body.data.password));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof AuthError && e.status === 401) {
        return c.json({ error: "Email or password is wrong" }, 401);
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
    if (!refresh) return c.json({ error: "Unauthorized" }, 401);
    try {
      setSession(c, await refreshSession(c.env, refresh));
      return c.json({ ok: true });
    } catch {
      clearSession(c);
      return c.json({ error: "Unauthorized" }, 401);
    }
  })
  .post("/reset", async (c) => {
    const body = resetRequest.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter a valid email" }, 400);
    const redirectTo = `${new URL(c.req.url).origin}/auth/callback`;
    await requestPasswordReset(c.env, body.data.email, redirectTo);
    // Same answer for known and unknown addresses (no account enumeration).
    return c.json({ ok: true });
  })
  .post("/session", async (c) => {
    // The reset link lands on /auth/callback with tokens in the URL fragment; the page hands
    // them over once so they end up in HttpOnly cookies and can be dropped from the page.
    const body = recoverySession.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid link" }, 400);
    const claims = await verifyAccessToken(body.data.accessToken, c.env.SUPABASE_URL);
    if (!claims) return c.json({ error: "The link is invalid or has expired" }, 401);
    setSession(c, body.data);
    return c.json({ ok: true });
  })
  .post("/password", async (c) => {
    const body = newPassword.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Use at least 12 characters" }, 400);
    const { access } = readSession(c);
    if (!(await verifyAccessToken(access, c.env.SUPABASE_URL)) || !access) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await updatePassword(c.env, access, body.data.password);
    return c.json({ ok: true });
  });
