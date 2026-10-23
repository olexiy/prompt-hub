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

test("new version by button, history, restore, plain save edits in place", async ({ page }) => {
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
  await page.evaluate(async () => {
    const me = (await (await fetch("/api/me")).json()) as { handle: string };
    const post = (url: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    await post("/api/projects", { slug: "p", name: "P" });
    await post(`/api/projects/${me.handle}/p/prompts`, {
      slug: "letter",
      title: "Letter",
      body: "Dear {{name}}, first draft.",
    });
    window.history.pushState(null, "", `/${me.handle}/p/letter`);
    window.dispatchEvent(new Event("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Letter" })).toBeVisible();

  // Edit: new text with a new variable and its default, a new title; no change-message field.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/^Title/).fill("Brief");
  await page.getByLabel("Prompt text").fill("Liebe(r) {{name}}, zweiter Entwurf über {{тема}}.");
  await page.getByRole("group", { name: "тема" }).getByLabel("Default").fill("Urlaub");
  await expect(page.getByLabel(/What changed/)).toHaveCount(0);
  await expectFitsScreen(page);
  await page.getByRole("button", { name: "Save as new version" }).click();

  await expect(page.getByRole("heading", { name: "Brief" })).toBeVisible();
  await expect(page.getByTestId("prompt-preview")).toContainText("zweiter Entwurf über Urlaub");
  await expect(page.getByText("v2", { exact: true })).toBeVisible();

  // History: newest first, live marked; view v1, restore it as v3.
  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByRole("button", { name: "Delete v2" })).toBeVisible();
  // Diff of v2 against v1: changed words are marked, the new variable is listed.
  await page.getByRole("button", { name: "Changes in v2" }).click();
  const diff = page.getByTestId("diff");
  await expect(diff).toContainText("v1 → v2");
  await expect(diff.locator("ins")).toContainText(["zweiter Entwurf über {{тема}}."]);
  await expect(diff).toContainText("New variable тема");
  await expectFitsScreen(page);

  await page.getByRole("button", { name: "View" }).last().click();
  await expect(page.getByTestId("version-body")).toHaveText("Dear {{name}}, first draft.");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored v1")).toBeVisible();

  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByTestId("prompt-preview")).toContainText("first draft");
  await expect(page.getByText("v3", { exact: true })).toBeVisible();

  // A plain save edits v3 in place: no v4 appears.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Prompt text").fill("Dear {{name}}, final draft.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("prompt-preview")).toContainText("final draft");
  await expect(page.getByText("v3", { exact: true })).toBeVisible();

  // Delete v2 from the history (confirmed).
  await page.getByRole("button", { name: /History/ }).click();
  await page.getByRole("button", { name: "Delete v2" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Delete v2" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete v4" })).toHaveCount(0);
  await expectFitsScreen(page);
  expect(errors).toEqual([]);
});
