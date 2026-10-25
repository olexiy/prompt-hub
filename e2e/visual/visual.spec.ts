/**
 * Visual regression of the main screens (#37), light and dark, desktop (1280) and phone (Pixel 7).
 * Fixed data under a fixed handle so the pictures are stable; dates are masked. Run with
 * `corepack pnpm visual`, refresh baselines on purpose with `corepack pnpm visual:update`.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { ownClientIp } from "../tests/users";

const EMAIL = "visual@example.test";
const HANDLE = "visual";

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

const SUPABASE = process.env.SUPABASE_URL ?? devVar("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? devVar("SUPABASE_SECRET_KEY") ?? "";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = { apikey: SECRET, authorization: `Bearer ${SECRET}` };

/**
 * Removes the visual user of an earlier run: the Supabase account and its `app_user` row (which
 * has no foreign key to auth.users, so it would keep the handle "visual" taken).
 */
async function cleanUp() {
  const list = await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const { users } = (await list.json()) as { users: { id: string; email?: string }[] };
  for (const u of users.filter((x) => x.email === EMAIL)) {
    await fetch(`${SUPABASE}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: admin });
  }
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`delete from app_user where handle = ${HANDLE}`;
  } finally {
    await sql.end();
  }
}

let password = "";
test.beforeAll(async () => {
  if (!SECRET) throw new Error("SUPABASE_SECRET_KEY missing (env or apps/api/.dev.vars)");
  await cleanUp();
  password = `pw-${crypto.randomUUID()}`;
  const res = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password, email_confirm: true }),
  });
  expect(res.ok).toBe(true);
});
test.afterAll(cleanUp);

async function api(page: Page, method: string, path: string, body?: unknown) {
  const res = await page.request.fetch(path, {
    method,
    headers: {
      origin: new URL(page.url()).origin,
      "content-type": "application/json",
      // page.request does not carry the page's extra headers: a fake IP of its own per call, so
      // repeated runs never meet the per-IP write limit.
      "cf-connecting-ip": `10.9.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`,
    },
    ...(body === undefined ? {} : { data: body }),
  });
  expect(res.ok(), `${method} ${path}`).toBe(true);
}

/** The same small project every run: a folder, three prompts, tags, meta, three versions. */
async function seed(page: Page) {
  await api(page, "PATCH", "/api/me", { theme: "system", locale: "en" });
  const listed = await page.request.get("/api/projects");
  if (((await listed.json()) as { projects: unknown[] }).projects.length > 0) return;
  const base = `/api/projects/${HANDLE}/portraits`;
  await api(page, "POST", "/api/projects", {
    slug: "portraits",
    name: "Portraits",
    description: "Studio and outdoor portrait prompts for image models.",
  });
  await api(page, "PATCH", base, { tags: ["photo", "portrait"] });
  await api(page, "POST", `${base}/folders`, { slug: "studio", name: "Studio" });
  await api(page, "POST", `${base}/prompts`, {
    folder: ["studio"],
    slug: "soft-light",
    title: "Soft light portrait",
    body: "A close-up portrait of {{subject}}, soft window light, {{style}} look, 85mm lens.",
    variables: [
      { name: "subject", description: "Who is in the picture" },
      { name: "style", default: "film" },
    ],
    tags: ["portrait", "studio"],
    meta: { description: "Base portrait for SDXL", model: "flux-dev" },
  });
  for (const body of [
    "A close-up portrait of {{subject}}, soft window light, {{style}} look, 50mm lens.",
    "A close-up portrait of {{subject}}, soft window light, {{style}} look, 85mm lens, shallow depth.",
  ]) {
    await api(page, "POST", `${base}/versions/studio/soft-light`, { body });
  }
  await api(page, "POST", `${base}/prompts`, {
    slug: "golden-hour",
    title: "Golden hour",
    body: "Outdoor portrait of {{subject}} at golden hour, warm rim light.",
    tags: ["outdoor"],
  });
  await api(page, "POST", "/api/projects", { slug: "letters", name: "Letters" });
}

async function shot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.locator(".ph-date")],
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`main screens (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    // Its own client IP, so repeated runs stay under the per-IP sign-in limit.
    await ownClientIp(page);
    await page.goto("/");
    await page.getByLabel("Email address").fill(EMAIL);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
    await seed(page);

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Portraits" }).first()).toBeVisible();
    await shot(page, `${theme}-dashboard`);

    await page.goto(`/${HANDLE}/portraits`);
    await expect(page.getByRole("link", { name: "Golden hour" })).toBeVisible();
    await shot(page, `${theme}-project`);

    await page.goto(`/${HANDLE}/portraits/studio/soft-light`);
    await expect(page.getByTestId("prompt-preview")).toBeVisible();
    await shot(page, `${theme}-prompt`);

    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.getByText("v3", { exact: true })).toBeVisible();
    await shot(page, `${theme}-history`);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Public profile" })).toBeVisible();
    await shot(page, `${theme}-settings`);
  });
}
