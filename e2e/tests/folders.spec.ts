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

test("folders: create, put a prompt inside, move it out, delete", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel(/^Name/).fill("Comfy H3");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/comfy-h3$/);

  // New folder → its own page.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel(/^Name/).fill("Night shots");
  await expect(page.getByLabel("URL slug")).toHaveValue("night-shots");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/comfy-h3\/night-shots$/);
  await expect(page.getByText("This folder is empty.")).toBeVisible();

  // A prompt inside the folder gets a nested URL and breadcrumbs.
  await page.getByRole("button", { name: "New prompt" }).click();
  await page.getByLabel(/^Title/).fill("Tram stop");
  await page.getByLabel("Prompt text").fill("Tram at {{time}}");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/comfy-h3\/night-shots\/tram-stop$/);
  await expect(page.getByRole("heading", { name: "Tram stop" })).toBeVisible();
  await expectFitsScreen(page);

  // Move to the project root.
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("menuitemradio", { name: "Project root" }).click();
  await expect(page).toHaveURL(/\/comfy-h3\/tram-stop$/);
  await expect(page.getByRole("heading", { name: "Tram stop" })).toBeVisible();

  // Delete the prompt (confirmed), then the empty folder.
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/comfy-h3$/);
  await page.getByRole("link", { name: "Night shots" }).click();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/comfy-h3$/);
  await expect(page.getByText("No prompts yet. Create the first one.")).toBeVisible();
  expect(errors).toEqual([]);
});
