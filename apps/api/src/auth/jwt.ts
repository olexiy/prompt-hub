/**
 * Verifies Supabase access tokens (ES256) against the project's JWKS: signature, issuer,
 * audience and expiry. The key set is cached per isolate and refreshed by jose on unknown `kid`.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessClaims {
  /** Supabase user id; also `app_user.id`. */
  sub: string;
  email: string;
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
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
