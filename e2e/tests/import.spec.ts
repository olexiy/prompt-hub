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

const md = [
  "---",
  "tags: [Видео, H3]",
  "description: Für Oma",
  "---",
  "# Девушка под дождём",
  "",
  "Девушка ждёт автобус, Größe {{größe}}.",
].join("\n");

test("import a prompt from .md (picker) and .txt (drop); other files are refused (#56)", async ({
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
    await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "p", name: "P" }),
    });
    return me.handle;
  });
  await page.goto(`/${handle}/p`);
  const picker = page.getByLabel("Choose a .md or .txt file");

  // Refused: wrong type, broken UTF-8.
  await picker.setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from([1]),
  });
  await expect(page.getByText("“photo.png” is not a .md or .txt file.")).toBeVisible();
  await picker.setInputFiles({
    name: "latin1.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([0x47, 0x72, 0xf6, 0xdf, 0x65]),
  });
  await expect(page.getByText("“latin1.txt” is not UTF-8 text.")).toBeVisible();

  // A Markdown file with front matter: preview, then create.
  await picker.setInputFiles({
    name: "girl.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(md, "utf8"),
  });
  const form = page.getByRole("form", { name: "Import a prompt" });
  await expect(form.getByLabel(/^Title/)).toHaveValue("Девушка под дождём");
  await expect(form.getByLabel(/^URL slug/)).toHaveValue("devushka-pod-dozhdem");
  await expect(form.getByLabel(/^Prompt text/)).toHaveValue(
    "Девушка ждёт автобус, Größe {{größe}}.",
  );
  await expect(form.getByText("Meta fields: description")).toBeVisible();
  await expectFitsScreen(page);
  await form.getByRole("button", { name: "Create prompt" }).click();
  await expect(page).toHaveURL(new RegExp(`/${handle}/p/devushka-pod-dozhdem$`));
  await expect(page.getByRole("heading", { name: "Девушка под дождём" })).toBeVisible();
  await expect(page.getByTestId("prompt-preview")).toContainText("Größe");
  await expect(page.getByRole("list", { name: "Tags" }).first()).toContainText("видео");
  await expect(page.getByRole("region", { name: "Meta" })).toContainText("Für Oma");

  // A text file dropped onto the project page; the title comes from the file name.
  await page.goto(`/${handle}/p`);
  const dropped = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["Liebe Oma, schöne Grüße!"], "Brief an Oma.txt", { type: "text/plain" }),
    );
    return data;
  });
  await page.locator(".ph-main-col").dispatchEvent("drop", { dataTransfer: dropped });
  await expect(form.getByLabel(/^Title/)).toHaveValue("Brief an Oma");
  await form.getByRole("button", { name: "Create prompt" }).click();
  await expect(page.getByRole("heading", { name: "Brief an Oma" })).toBeVisible();
  await expect(page.getByTestId("prompt-preview")).toHaveText("Liebe Oma, schöne Grüße!");

  expect(errors).toEqual([]);
});
