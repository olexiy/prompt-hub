import { expect, test } from "@playwright/test";

test("home page loads and reaches the API without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Prompt Hub");
  await expect(page.getByRole("heading", { level: 1, name: "Prompt Hub" })).toBeVisible();
  await expect(page.getByText("ok", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("deep links fall back to the app", async ({ page }) => {
  const res = await page.goto("/olexiy/comfy-h3/bus-stop-9s");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Prompt Hub" })).toBeVisible();
});
