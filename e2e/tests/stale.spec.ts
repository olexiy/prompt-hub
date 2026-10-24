import { expect, test } from "@playwright/test";
import { createUser, ownClientIp, type TestUser } from "./users";

let user: TestUser;
test.beforeEach(async ({ page }) => {
  user = await createUser();
  await ownClientIp(page);
});
test.afterEach(async () => {
  await user.remove();
});

test("a tab older than the deployed build offers a reload and sends no writes (#73)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await expect(page.getByText("A new version is available")).toHaveCount(0);

  // The server really refuses writes that carry another build id.
  const refused = await page.evaluate(async () => {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", "X-App-Build": "an-old-build" },
      body: JSON.stringify({ theme: "dark" }),
    });
    return { status: res.status, build: res.headers.get("X-App-Build") };
  });
  expect(refused.status).toBe(409);
  expect(refused.build).toBeTruthy();

  // Simulate a deploy: from now on the API reports another build.
  await page.route("**/api/**", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "x-app-build": "newer" } });
  });
  let writes = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/") && req.method() !== "GET") writes += 1;
  });

  // Coming back to the tab asks the API, which reveals the new build.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("A new version is available")).toBeVisible();

  // A write from the old tab never leaves the browser.
  await page.getByRole("button", { name: /Switch theme/ }).click();
  await expect(page.getByRole("button", { name: /Theme: System/ })).toBeVisible();
  expect(writes).toBe(0);

  // Reload loads the current build: the banner is gone.
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await expect(page.getByText("A new version is available")).toHaveCount(0);
  expect(errors).toEqual([]);
});
