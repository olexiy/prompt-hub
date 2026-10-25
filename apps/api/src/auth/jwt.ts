/**
 * Verifies Supabase access tokens (ES256) against the project's JWKS: signature, issuer,
 * audience and expiry. The key set is cached per isolate and refreshed by jose on unknown `kid`.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessClaims {
  /** Supabase user id; also `app_user.id`. */
  sub: string;
  email: string;
  /** How the session was authenticated (`amr` claim): method name and unix time in seconds. */
  amr: { method: string; timestamp: number }[];
}

/** How long a session from a reset or invite link may set a password without the old one. */
export const LINK_SESSION_SECONDS = 60 * 60;

/**
 * True when the session came from a password-reset or invite link within the last hour (#61).
 * Only such sessions may be handed over by /auth/callback and may set a new password: a normal
 * session cannot, so a stolen or planted session is not enough to take over an account.
 */
export function isFreshLinkSession(claims: AccessClaims, now = Date.now() / 1000): boolean {
  return claims.amr.some(
    (a) =>
      (a.method === "recovery" || a.method === "invite") &&
      now - a.timestamp <= LINK_SESSION_SECONDS,
  );
}

function amrOf(value: unknown): AccessClaims["amr"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((a: unknown) => {
    if (!a || typeof a !== "object") return [];
    const { method, timestamp } = a as { method?: unknown; timestamp?: unknown };
    return typeof method === "string" && typeof timestamp === "number"
      ? [{ method, timestamp }]
      : [];
  });
}

const keySets = new Map<string, JWTVerifyGetKey>();

function keySet(supabaseUrl: string): JWTVerifyGetKey {
  let set = keySets.get(supabaseUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    keySets.set(supabaseUrl, set);
  }
  return set;
}

/** Returns the claims of a valid token, or null for anything else (missing, forged, expired). */
export async function verifyAccessToken(
  token: string | undefined,
  supabaseUrl: string,
): Promise<AccessClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keySet(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email, amr: amrOf(payload.amr) };
  } catch {
    return null;
  }
}
