import { expect, test } from "@playwright/test";
import { expectFitsScreen } from "./layout";
import { createUser, ownClientIp, type TestUser } from "./users";

let user: TestUser;
test.beforeEach(async ({ context, page }) => {
  user = await createUser();
  await ownClientIp(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});
test.afterEach(async () => {
  await user.remove();
});

test("create project → create prompt → fill variables → copy the rendered prompt", async ({
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
  await expectFitsScreen(page);

  // Project: the slug is suggested from the name.
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel(/^Name/).fill("Comfy H3");
  await expect(page.getByLabel("URL slug")).toHaveValue("comfy-h3");
  // A long word without spaces must wrap, not widen the page (#45).
  await page
    .getByLabel("Description (optional)")
    .fill(
      "Video prompts: MiniMax-H3-shot-lists-with-appearance-and-background-locks-for-9-second-clips",
    );
  await expectFitsScreen(page);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/comfy-h3$/);
  await expect(page.getByText("No prompts yet. Create the first one.")).toBeVisible();
  await expectFitsScreen(page);

  // Prompt with Cyrillic and German variable names.
  await page.getByRole("button", { name: "New prompt" }).click();
  await page.getByLabel(/^Title/).fill("Bus stop 9s");
  await page
    .getByLabel("Prompt text")
    .fill("Shot of {{subject}} at {{время}}.\nGröße: {{Größe}}, again {{subject}}.");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/comfy-h3\/bus-stop-9s$/);
  await expect(page.getByRole("heading", { name: "Bus stop 9s" })).toBeVisible();
  await expectFitsScreen(page);

  // Unfilled variables are flagged, and the copy keeps their placeholders.
  await expect(page.getByRole("note")).toContainText("subject, время, Größe");
  await page.getByLabel("subject").fill("a red bus");
  await page.getByLabel("время").fill("сумерки");
  await expect(page.getByTestId("prompt-preview")).toContainText("Shot of a red bus at сумерки.");
  await expect(page.getByRole("note")).toContainText("Größe");

  await page.getByLabel("Größe").fill("groß");
  await expect(page.getByRole("note")).toBeHidden();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect(page.getByText("Copied to the clipboard")).toBeVisible();
  // The Windows clipboard stores CRLF line ends; compare the text, not the platform newline.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe(
    "Shot of a red bus at сумерки.\nGröße: groß, again a red bus.",
  );

  // The dashboard now lists the project with its prompt count.
  await page.getByRole("link", { name: "Prompt Hub home" }).click();
  await expect(page.getByRole("link", { name: "Comfy H3" })).toBeVisible();
  await expect(page.getByText("Prompts: 1")).toBeVisible();
  await expectFitsScreen(page);
  expect(errors).toEqual([]);
});
