/**
 * Creates a confirmed user in the local Supabase for the e2e run (sign-up is closed) and writes
 * the credentials to e2e/.auth/user.json (gitignored); the teardown deletes the user.
 * Needs local Supabase (`pnpm db:start`) and SUPABASE_URL / SUPABASE_SECRET_KEY in the environment
 * or in apps/api/.dev.vars.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

function devVar(name: string): string | undefined {
  try {
    const line = readFileSync("../apps/api/.dev.vars", { encoding: "utf8" })
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1);
  } catch {
    return undefined;
  }
}

export const AUTH_FILE = ".auth/user.json";

export default async function globalSetup() {
  const url = process.env.SUPABASE_URL ?? devVar("SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const secret = process.env.SUPABASE_SECRET_KEY ?? devVar("SUPABASE_SECRET_KEY");
  if (!secret) throw new Error("SUPABASE_SECRET_KEY missing (env or apps/api/.dev.vars)");
  const headers = { apikey: secret, authorization: `Bearer ${secret}` };
  const email = `e2e-${String(Date.now())}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Could not create e2e user: ${String(res.status)}`);
  const { id } = (await res.json()) as { id: string };
  mkdirSync(".auth", { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify({ email, password }));

  return async () => {
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
  };
}
