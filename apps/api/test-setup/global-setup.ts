/**
 * Runs in Node before the Workers tests: creates a confirmed test user in the local Supabase
 * (sign-up is closed, so only the admin API can do it) and hands the credentials to the tests.
 * Needs local Supabase running (`pnpm db:start`) and its secret key in SUPABASE_SECRET_KEY
 * or apps/api/.dev.vars; migrations applied (`pnpm db:migrate`).
 */
import { readFileSync } from "node:fs";
import type { TestProject } from "vitest/node";

function devVar(name: string): string | undefined {
  try {
    // Vitest runs with apps/api as the working directory.
    const line = readFileSync(".dev.vars", { encoding: "utf8" })
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1);
  } catch {
    return undefined;
  }
}

export default async function setup(project: TestProject) {
  const url = process.env.SUPABASE_URL ?? devVar("SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const secret = process.env.SUPABASE_SECRET_KEY ?? devVar("SUPABASE_SECRET_KEY");
  if (!secret) throw new Error("SUPABASE_SECRET_KEY missing (env or apps/api/.dev.vars)");
  const email = `test-${String(Date.now())}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Could not create test user: ${String(res.status)}`);
  const user = (await res.json()) as { id: string };
  project.provide("testUser", { email, password });

  return async () => {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { apikey: secret, authorization: `Bearer ${secret}` },
    });
  };
}
