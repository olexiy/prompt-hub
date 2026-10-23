/**
 * Throwaway users for specs that change account state (language, theme): each test gets its own
 * user, so parallel tests and the desktop/phone projects never see each other's changes.
 */
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

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

export interface TestUser {
  email: string;
  password: string;
  remove: () => Promise<void>;
}

export async function createUser(): Promise<TestUser> {
  const url = process.env.SUPABASE_URL ?? devVar("SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const secret = process.env.SUPABASE_SECRET_KEY ?? devVar("SUPABASE_SECRET_KEY");
  if (!secret) throw new Error("SUPABASE_SECRET_KEY missing (env or apps/api/.dev.vars)");
  const headers = { apikey: secret, authorization: `Bearer ${secret}` };
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Could not create e2e user: ${String(res.status)}`);
  const { id } = (await res.json()) as { id: string };
  return {
    email,
    password,
    remove: async () => {
      await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
    },
  };
}

/**
 * Every request of this page comes from its own fake client IP, so the per-IP auth rate limit
 * (10 sign-ins a minute) never trips across the many sign-ins of a run. Cloudflare overwrites
 * this header in production; `wrangler dev` passes it through.
 */
export async function ownClientIp(page: Page): Promise<void> {
  const n = () => String(Math.floor(Math.random() * 250) + 1);
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `10.${n()}.${n()}.${n()}` });
}
