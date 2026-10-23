/**
 * Session cookies. `__Host-` prefix forces Secure, Path=/ and no Domain; HttpOnly keeps tokens
 * away from page scripts; SameSite=Lax plus the origin check in middleware.ts blocks CSRF.
 */
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AuthTokens } from "./supabase";

export const ACCESS_COOKIE = "__Host-ph_at";
export const REFRESH_COOKIE = "__Host-ph_rt";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const base = { path: "/", secure: true, httpOnly: true, sameSite: "Lax" } as const;

export function setSession(c: Context, t: AuthTokens): void {
  setCookie(c, ACCESS_COOKIE, t.accessToken, { ...base, maxAge: t.expiresIn });
  setCookie(c, REFRESH_COOKIE, t.refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearSession(c: Context): void {
  deleteCookie(c, ACCESS_COOKIE, base);
  deleteCookie(c, REFRESH_COOKIE, base);
}

export function readSession(c: Context): {
  access: string | undefined;
  refresh: string | undefined;
} {
  return { access: getCookie(c, ACCESS_COOKIE), refresh: getCookie(c, REFRESH_COOKIE) };
}
