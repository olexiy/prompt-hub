/**
 * Thin client for the Supabase Auth REST API (GoTrue). Only the Worker talks to it; the browser
 * never sees Supabase tokens or keys (sessions live in HttpOnly cookies, see cookies.ts).
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface SupabaseConfig {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}

async function call(env: SupabaseConfig, path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);
  headers.set("content-type", "application/json");
  return fetch(`${env.SUPABASE_URL}/auth/v1${path}`, { ...init, headers });
}

async function tokens(res: Response): Promise<AuthTokens> {
  if (!res.ok) {
    // GoTrue error bodies may contain details; never forward them to the client.
    throw new AuthError(
      res.status === 400 || res.status === 401 ? 401 : 502,
      "Authentication failed",
    );
  }
  const body: { access_token: string; refresh_token: string; expires_in: number } =
    await res.json();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
  };
}

export async function signInWithPassword(
  env: SupabaseConfig,
  email: string,
  password: string,
): Promise<AuthTokens> {
  return tokens(
    await call(env, "/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
}

export async function refreshSession(
  env: SupabaseConfig,
  refreshToken: string,
): Promise<AuthTokens> {
  return tokens(
    await call(env, "/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  );
}

/** Revokes the refresh token of this session; errors are ignored (sign-out always succeeds locally). */
export async function signOut(env: SupabaseConfig, accessToken: string): Promise<void> {
  await call(env, "/logout?scope=local", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}

/** Sends the reset email; the response is the same whether or not the address exists. */
export async function requestPasswordReset(
  env: SupabaseConfig,
  email: string,
  redirectTo: string,
): Promise<void> {
  await call(env, `/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  }).catch(() => undefined);
}

export async function updatePassword(
  env: SupabaseConfig,
  accessToken: string,
  password: string,
): Promise<void> {
  const res = await call(env, "/user", {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new AuthError(res.status === 422 ? 400 : 401, "Password not accepted");
}
