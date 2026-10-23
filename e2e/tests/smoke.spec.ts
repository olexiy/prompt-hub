import { expect, test } from "@playwright/test";

test("home page loads without console errors and the API is up", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Prompt Hub");
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
  expect(errors).toEqual([]);

  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ status: "ok", app: "Prompt Hub" });
});

test("deep links fall back to the app", async ({ page }) => {
  const res = await page.goto("/olexiy/comfy-h3/bus-stop-9s");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
});
