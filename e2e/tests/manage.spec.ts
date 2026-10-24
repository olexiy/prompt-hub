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

test("project settings: rename and new slug, archive, duplicate a prompt, delete by typing the name (#51)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  const handle = await page.evaluate(async () => {
    const me = (await (await fetch("/api/me")).json()) as { handle: string };
    const post = (url: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    await post("/api/projects", { slug: "old", name: "Old name" });
    await post(`/api/projects/${me.handle}/old/prompts`, {
      slug: "letter",
      title: "Letter",
      body: "Dear {{name}}.",
    });
    return me.handle;
  });

  // Rename and move to a new slug: the app follows to the new URL.
  await page.goto(`/${handle}/old`);
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("form", { name: "Project settings" });
  await settings.getByLabel(/^Name/).fill("Letters");
  await settings.getByLabel(/^URL slug/).fill("letters");
  await expect(settings.getByText(/Old links to this project stop working/)).toBeVisible();
  await expectFitsScreen(page);
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/${handle}/letters$`));
  await expect(page.locator(".ph-about")).toContainText("Letters");

  // Archive: hidden from the dashboard, listed under "Archived", still reachable.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Archive project", exact: true }).click();
  await expect(page.getByText("This project is archived")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await page.getByRole("button", { name: "Archived" }).click();
  await expectFitsScreen(page);
  await page.getByRole("link", { name: "Letters", exact: true }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Unarchive project", exact: true }).click();
  await expect(page.getByText("This project is archived")).toHaveCount(0);

  // Duplicate a prompt: the copy opens with the current version as v1.
  await page.goto(`/${handle}/letters/letter`);
  await page.getByRole("button", { name: "Duplicate" }).click();
  const dup = page.getByRole("form", { name: "Duplicate prompt" });
  await expect(dup.getByLabel(/^Title/)).toHaveValue("Letter (copy)");
  await dup.getByRole("button", { name: "Duplicate" }).click();
  await expect(page).toHaveURL(new RegExp(`/${handle}/letters/letter-copy$`));
  await expect(page.getByRole("heading", { name: "Letter (copy)" })).toBeVisible();
  await expect(page.getByText("v1", { exact: true })).toBeVisible();

  // Delete: only after typing the exact project name; then it is gone for good.
  await page.goto(`/${handle}/letters`);
  await page.getByRole("button", { name: "Settings" }).click();
  const deleteButton = page.getByRole("button", { name: "Delete project" });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Type Letters to confirm").fill("letters");
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Type Letters to confirm").fill("Letters");
  await deleteButton.click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await page.goto(`/${handle}/letters`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // 404s of the deleted project are expected; nothing else may log an error.
  expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
});
