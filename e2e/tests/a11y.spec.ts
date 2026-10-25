/**
 * Automated accessibility check (#38): axe-core over the main screens in light and dark mode,
 * WCAG 2.1 A/AA rules. Catches missing labels, contrast, ARIA misuse and landmark problems; a
 * manual keyboard and screen-reader pass is still part of the UX review.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createUser, ownClientIp, type TestUser } from "./users";

let user: TestUser;
test.beforeEach(async () => {
  user = await createUser();
});
test.afterEach(async () => {
  await user.remove();
});

/** Violations of WCAG 2.1 A/AA on the current page, as "rule: target" lines for a readable diff. */
async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return result.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} — ${v.help}`),
  );
}

/** JSON write as the web app sends it (same origin, JSON), with the page's session cookies. */
async function api(page: Page, method: string, path: string, body: unknown) {
  const res = await page.request.fetch(path, {
    method,
    headers: {
      origin: new URL(page.url()).origin,
      "content-type": "application/json",
      // page.request does not carry the page's extra headers; its own fake IP per call.
      "cf-connecting-ip": `10.8.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`,
    },
    data: body,
  });
  expect(res.ok(), `${method} ${path}`).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  test(`main screens have no WCAG A/AA violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await ownClientIp(page);
    await page.goto("/");
    await page.getByLabel("Email address").waitFor();
    expect(await violations(page), "sign-in").toEqual([]);

    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    expect(await violations(page), "empty dashboard").toEqual([]);

    // Theme "system" follows the emulated color scheme.
    await api(page, "PATCH", "/api/me", { theme: "system" });
    await api(page, "POST", "/api/projects", { slug: "a11y", name: "A11y", description: "Check" });
    await api(page, "POST", `/api/projects/${await handle(page)}/a11y/prompts`, {
      slug: "portrait",
      title: "Portrait",
      body: "A photo of {{subject}} in {{style}} style",
      variables: [{ name: "style", default: "film" }],
      tags: ["photo"],
      meta: { model: "flux" },
    });

    await page.goto("/");
    await expect(page.getByRole("link", { name: "A11y" }).first()).toBeVisible();
    expect(await violations(page), "dashboard").toEqual([]);

    await page.getByRole("link", { name: "A11y" }).first().click();
    await expect(page.getByRole("link", { name: "Portrait" })).toBeVisible();
    expect(await violations(page), "project").toEqual([]);

    await page.getByRole("link", { name: "Portrait" }).click();
    await expect(page.getByRole("heading", { name: "Portrait" })).toBeVisible();
    expect(await violations(page), "prompt").toEqual([]);

    await page.goto("/search?q=photo");
    await expect(page.getByRole("link", { name: "Portrait" })).toBeVisible();
    expect(await violations(page), "search").toEqual([]);
  });
}

async function handle(page: Page): Promise<string> {
  const res = await page.request.get("/api/me");
  return ((await res.json()) as { handle: string }).handle;
}
