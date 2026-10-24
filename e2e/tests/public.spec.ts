import { expect, test } from "@playwright/test";
import { expectFitsScreen } from "./layout";
import { createUser, ownClientIp, type TestUser } from "./users";

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createUser();
  await ownClientIp(page);
});
test.afterEach(async () => {
  await user.remove();
});

test("a public project is readable signed out: live version only, no owner tools (#53)", async ({
  page,
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  const handle = await page.evaluate(async () => {
    const me = (await (await fetch("/api/me")).json()) as { handle: string };
    const send = (method: string, url: string, body: unknown) =>
      fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const base = `/api/projects/${me.handle}/pub`;
    await send("POST", "/api/projects", { slug: "pub", name: "Shared prompts" });
    await send("POST", "/api/projects", { slug: "secret", name: "Secret" });
    await send("POST", `${base}/prompts`, { slug: "letter", title: "Letter", body: "Old text" });
    await send("POST", `${base}/versions/letter`, { body: "Dear {{name}}, hello." });
    await send("PATCH", `${base}/path/letter`, {
      meta: { description: "For friends", note: "my private note" },
    });
    return me.handle;
  });

  // The owner makes the project public in its settings.
  await page.goto(`/${handle}/pub`);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Make public" }).click();
  await expect(page.getByRole("button", { name: "Make private" })).toBeVisible();

  // A visitor without an account.
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  const visitor = await context.newPage();
  await ownClientIp(visitor);
  const visitorErrors: string[] = [];
  visitor.on("pageerror", (err) => visitorErrors.push(err.message));

  const res = await visitor.goto(`/${handle}/pub/letter`);
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(visitor.getByRole("heading", { name: "Letter" })).toBeVisible();
  await expect(visitor.getByTestId("prompt-preview")).toHaveText("Dear {{name}}, hello.");
  await visitor.getByLabel("name").fill("Ann");
  await expect(visitor.getByTestId("prompt-preview")).toContainText("Dear Ann, hello.");
  const meta = visitor.getByRole("region", { name: "Meta" });
  await expect(meta.locator("dt")).toHaveText(["Description"]);
  await expect(visitor.getByText("my private note")).toHaveCount(0);
  for (const name of ["Edit", "History", "Duplicate", "Move", "Delete", "Edit meta fields"]) {
    await expect(visitor.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(visitor.getByText("v2", { exact: true })).toHaveCount(0);
  await expect(visitor.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expectFitsScreen(visitor);

  // The project root: listing without owner tools.
  await visitor.goto(`/${handle}/pub`);
  await expect(visitor.getByRole("link", { name: "Letter" })).toBeVisible();
  for (const name of ["Settings", "New folder", "New prompt"]) {
    await expect(visitor.getByRole("button", { name })).toHaveCount(0);
  }

  // Private projects stay invisible, and so does this one once it is private again.
  await visitor.goto(`/${handle}/secret`);
  await expect(visitor.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("button", { name: "Make private" }).click();
  await expect(page.getByRole("button", { name: "Make public" })).toBeVisible();
  await visitor.goto(`/${handle}/pub/letter`);
  await expect(visitor.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await context.close();
  expect(errors).toEqual([]);
  expect(visitorErrors).toEqual([]);
});
