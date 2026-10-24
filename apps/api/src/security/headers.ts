/**
 * Security headers for responses produced by the Worker (/api/*). Static files and the SPA HTML
 * are served by the platform and get their headers from apps/web/public/_headers instead.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

/** API responses are JSON only: nothing may load, run or frame them. */
export const API_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": API_CSP,
  // Two years; preload is added once the production domain is final (#21).
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  // Public project data is for people with the link, not for search engines yet (ADR #53).
  "X-Robots-Tag": "noindex, nofollow",
  // API answers are per user; no shared or browser cache may keep them.
  "Cache-Control": "no-store",
};

/** Sets the headers after the handler ran, so error and 404 responses get them too. */
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) c.res.headers.set(name, value);
});
