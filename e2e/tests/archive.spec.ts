import { readFile } from "node:fs/promises";
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

test("download a project as zip and import it again as a new project (#57)", async ({ page }) => {
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
    const base = `/api/projects/${me.handle}/clips`;
    await post("/api/projects", { slug: "clips", name: "Clips" });
    await post(`${base}/folders`, { slug: "rain", name: "Дождь" });
    await post(`${base}/prompts`, {
      folder: ["rain"],
      slug: "girl",
      title: "Девушка",
      body: "Ждёт {{время}}.",
      tags: ["видео"],
    });
    return me.handle;
  });

  // Export from the project page.
  await page.goto(`/${handle}/clips`);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download as zip" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("clips.zip");
  const saved = await file.path();
  const zip = await readFile(saved);

  // Not a zip: refused before anything happens.
  await page.goto("/");
  const picker = page.getByLabel("Choose a project .zip");
  await picker.setInputFiles({
    name: "notes.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("plain text"),
  });
  await expect(page.getByText("“notes.zip” is not a zip archive.")).toBeVisible();

  // Import the downloaded archive under a new slug.
  await picker.setInputFiles({ name: "clips.zip", mimeType: "application/zip", buffer: zip });
  const form = page.getByRole("form", { name: "Import a project" });
  await expect(form.getByText("Folders: 1 · Prompts: 1")).toBeVisible();
  await expect(form.getByText("rain/girl")).toBeVisible();
  await expectFitsScreen(page);
  await form.getByLabel(/^URL slug/).fill("clips-copy");
  await form.getByLabel(/^Name/).fill("Clips copy");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(new RegExp(`/${handle}/clips-copy$`));
  await page.getByRole("link", { name: "Дождь" }).click();
  await page.getByRole("link", { name: "Девушка" }).click();
  await expect(page.getByTestId("prompt-preview")).toHaveText("Ждёт {{время}}.");
  await expect(page.getByRole("list", { name: "Topics" }).first()).toContainText("видео");

  expect(errors).toEqual([]);
});
