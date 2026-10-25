/**
 * Local performance budget (#37): p95 latency per key endpoint against the LOCAL stack only
 * (wrangler dev + local Supabase). Never points at Cloudflare or Supabase cloud: the base URL
 * must be localhost/127.0.0.1, so free-tier quotas are never touched.
 *
 *   corepack pnpm perf                       # against http://127.0.0.1:8787 (`pnpm dev` running)
 *   PERF_URL=http://127.0.0.1:8788 corepack pnpm perf
 *
 * Seeds a throwaway user with a project of SEED_PROMPTS prompts (some in folders, with tags and
 * a few versions), measures each scenario, prints p50/p95/max and fails when a p95 is over its
 * budget. The user is deleted afterwards.
 */
import { readFileSync } from "node:fs";

const BASE = process.env.PERF_URL ?? "http://127.0.0.1:8787";
const REQUESTS = Number(process.env.PERF_REQUESTS ?? 100);
const CONCURRENCY = Number(process.env.PERF_CONCURRENCY ?? 5);
const SEED_PROMPTS = 60;

/**
 * p95 budgets in ms on a developer machine: about 4x what was measured on 2026-10-25 (sign-in
 * ~95 ms, reads ~50-60 ms at 5 in parallel), so noise passes and an N+1 query or a missing index
 * does not.
 */
const BUDGETS: Record<string, number> = {
  "sign-in": 500,
  "list projects": 200,
  "project root": 200,
  "open prompt": 200,
  "version history": 200,
  search: 250,
};

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  throw new Error(`PERF_URL must be a local address, got ${BASE}`);
}

function devVar(name: string): string | undefined {
  try {
    const line = readFileSync(new URL("../../apps/api/.dev.vars", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1);
  } catch {
    return undefined;
  }
}

const SUPABASE = process.env.SUPABASE_URL ?? devVar("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? devVar("SUPABASE_SECRET_KEY");
if (!SECRET) throw new Error("SUPABASE_SECRET_KEY missing (env or apps/api/.dev.vars)");
const admin = { apikey: SECRET, authorization: `Bearer ${SECRET}` };

/** A fake client IP per request keeps the per-IP rate limits out of the measurement. */
const ip = () => `10.${String(rand())}.${String(rand())}.${String(rand())}`;
const rand = () => Math.floor(Math.random() * 250) + 1;

async function call(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      "content-type": "application/json",
      "cf-connecting-ip": ip(),
      cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${String(res.status)}`);
  return res;
}

const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function measure(n: number, run: () => Promise<unknown>): Promise<number[]> {
  const times: number[] = [];
  let next = 0;
  async function worker() {
    while (next < n) {
      next++;
      const t = performance.now();
      await run();
      times.push(performance.now() - t);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return times.sort((a, b) => a - b);
}

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;

async function main() {
  const email = `perf-${crypto.randomUUID()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const created = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`Could not create perf user: ${String(created.status)}`);
  const { id } = (await created.json()) as { id: string };

  try {
    const signIn = () => call("POST", "/api/auth/sign-in", "", { email, password });
    const cookie = cookiesOf(await signIn());
    const { handle } = (await (await call("GET", "/api/me", cookie)).json()) as { handle: string };
    const base = `/api/projects/${handle}/perf`;

    // Seed: one project, two folders, SEED_PROMPTS prompts with tags, three versions on one.
    await call("POST", "/api/projects", cookie, { slug: "perf", name: "Perf" });
    for (const slug of ["shots", "styles"]) {
      await call("POST", `${base}/folders`, cookie, { slug, name: slug });
    }
    for (let i = 0; i < SEED_PROMPTS; i++) {
      await call("POST", `${base}/prompts`, cookie, {
        folder: i % 3 === 0 ? [] : [i % 3 === 1 ? "shots" : "styles"],
        slug: `prompt-${String(i)}`,
        title: `Prompt ${String(i)} portrait lighting`,
        body: `A cinematic portrait of {{subject}} number ${String(i)}, soft light, 35mm film`,
        tags: [`tag-${String(i % 7)}`, "portrait"],
      });
    }
    for (let v = 0; v < 3; v++) {
      await call("POST", `${base}/versions/shots/prompt-1`, cookie, { body: `v${String(v)}` });
    }

    const scenarios: [string, () => Promise<unknown>, number][] = [
      ["sign-in", signIn, Math.min(REQUESTS, 20)],
      ["list projects", () => call("GET", "/api/projects", cookie), REQUESTS],
      ["project root", () => call("GET", base, cookie), REQUESTS],
      ["open prompt", () => call("GET", `${base}/path/shots/prompt-1`, cookie), REQUESTS],
      ["version history", () => call("GET", `${base}/versions/shots/prompt-1`, cookie), REQUESTS],
      ["search", () => call("GET", "/api/search?q=portrait%20light", cookie), REQUESTS],
    ];

    let failed = false;
    console.log(`Perf against ${BASE}: ${String(CONCURRENCY)} in parallel\n`);
    console.log(
      "scenario".padEnd(18),
      "n".padStart(4),
      "p50".padStart(7),
      "p95".padStart(7),
      "max".padStart(7),
      "budget".padStart(8),
    );
    for (const [name, run, n] of scenarios) {
      await run(); // warm-up
      const t = await measure(n, run);
      const p95 = pct(t, 95);
      const budget = BUDGETS[name] ?? Infinity;
      const over = p95 > budget;
      failed ||= over;
      console.log(
        name.padEnd(18),
        String(t.length).padStart(4),
        `${pct(t, 50).toFixed(0)}ms`.padStart(7),
        `${p95.toFixed(0)}ms`.padStart(7),
        `${(t.at(-1) ?? 0).toFixed(0)}ms`.padStart(7),
        `${String(budget)}ms`.padStart(8),
        over ? "  OVER BUDGET" : "",
      );
    }
    if (failed) {
      console.error("\nAt least one p95 is over its budget.");
      process.exitCode = 1;
    }
  } finally {
    await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
  }
}

await main();
