/** Request guards: same-origin check for state-changing requests and the signed-in user. */
import { createDb } from "@prompt-hub/db";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";
import { readSession } from "./cookies";
import { verifyAccessToken } from "./jwt";
import { ensureAppUser } from "./users";

/**
 * CSRF defence in addition to SameSite=Lax: a non-GET request must come from our own origin
 * and carry JSON (HTML forms on other sites can do neither without a CORS preflight).
 */
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    if (origin !== new URL(c.req.url).origin) return c.json({ error: "Forbidden" }, 403);
    if (!c.req.header("content-type")?.startsWith("application/json")) {
      return c.json({ error: "Expected JSON" }, 415);
    }
  }
  await next();
});

/** 401 unless the access cookie holds a valid Supabase token; loads (or creates) `app_user`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const claims = await verifyAccessToken(readSession(c).access, c.env.SUPABASE_URL);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);
  const { db } = createDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  c.set("user", await ensureAppUser(db, claims));
  await next();
});
