/** Request guards: same-origin check for state-changing requests and the signed-in user. */
import { errorBody } from "@prompt-hub/core";
import { createDb } from "@prompt-hub/db";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";
import { log } from "../security/log";
import { clientIp } from "../security/rate-limit";
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
    if (origin !== new URL(c.req.url).origin) {
      log.warn("origin_refused", { origin, ip: clientIp(c.req), path: c.req.path });
      return c.json(errorBody("forbidden"), 403);
    }
    if (!c.req.header("content-type")?.startsWith("application/json")) {
      return c.json(errorBody("expectedJson"), 415);
    }
  }
  await next();
});

/** 401 unless the access cookie holds a valid Supabase token; loads (or creates) `app_user`. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const claims = await verifyAccessToken(readSession(c).access, c.env.SUPABASE_URL);
  if (!claims) return c.json(errorBody("unauthorized"), 401);
  const { db } = createDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  c.set("user", await ensureAppUser(db, claims));
  await next();
});
