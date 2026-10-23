/**
 * Rate limiting with the Workers Rate Limiting binding (limits are set in wrangler.jsonc).
 * Counters are per Cloudflare location and approximate — a brake on brute force and abuse,
 * not an exact quota.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

/** Which binding to use: strict for credential endpoints, looser for other writes. */
export type Limiter = "AUTH_LIMITER" | "WRITE_LIMITER";

/**
 * Client IP as Cloudflare reports it. The edge overwrites this header, so a client cannot forge
 * it in production; locally and in tests it may be missing.
 */
export function clientIp(headers: { header(name: string): string | undefined }): string {
  return headers.header("cf-connecting-ip") ?? "unknown";
}

/** 429 with Retry-After once the client IP is over the limiter's budget. */
export function rateLimit(limiter: Limiter) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { success } = await c.env[limiter].limit({ key: clientIp(c.req) });
    if (!success) {
      c.header("Retry-After", "60");
      return c.json({ error: "Too many requests. Try again in a minute." }, 429);
    }
    await next();
  });
}

/** WRITE_LIMITER on every state-changing request (GET and HEAD pass through). */
export const limitWrites = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD") return next();
  return rateLimit("WRITE_LIMITER")(c, next);
});
