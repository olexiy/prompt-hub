import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ownClientIp } from "./users";

const user = JSON.parse(readFileSync(".auth/user.json", { encoding: "utf8" })) as {
  email: string;
  password: string;
};

test.beforeEach(async ({ page }) => {
  await ownClientIp(page);
});

test("sign in, see the handle, keep tokens away from scripts, sign out", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).toBe("");

  await page.reload();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();

  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("wrong password shows a message", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
});
