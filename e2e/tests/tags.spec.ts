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

test("tags: set on projects and prompts in any script, filter by chip and text (#54)", async ({
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
    await post("/api/projects", { slug: "clips", name: "Clips" });
    await post("/api/projects", { slug: "letters", name: "Letters" });
    await post(`/api/projects/${me.handle}/clips/prompts`, {
      slug: "bus",
      title: "Bus stop",
      body: "x",
    });
    await post(`/api/projects/${me.handle}/clips/prompts`, {
      slug: "rain",
      title: "Rain",
      body: "y",
    });
    return me.handle;
  });

  // Project tags in the settings, normalised as typed.
  await page.goto(`/${handle}/clips`);
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("form", { name: "Project settings" });
  await settings.getByLabel("Tags").fill("a/b");
  await settings.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Tag “a\/b” is not allowed/).first()).toBeVisible();
  await settings.getByLabel("Tags").fill("Video, MiniMax H3, Видео");
  await settings.getByRole("button", { name: "Save" }).click();
  const about = page.locator(".ph-about");
  await expect(about.getByRole("button")).toHaveText(["minimax-h3", "video", "видео"]);

  // Prompt tags inline on the prompt page.
  await page.goto(`/${handle}/clips/bus`);
  await page.getByRole("button", { name: "Add tags" }).click();
  await page.getByLabel("Tags, separated by commas").fill("9s, видео");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("list", { name: "Tags" }).getByText("видео")).toBeVisible();
  await expectFitsScreen(page);

  // Project page: chip filter narrows prompts, text filter combines with it.
  await page.goto(`/${handle}/clips`);
  const rows = page.locator(".ph-box-row");
  await expect(rows).toHaveCount(2);
  await rows.filter({ hasText: "Bus stop" }).getByRole("button", { name: "9s" }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("Tag: 9s")).toBeVisible();
  await page.getByLabel("Filter by title or tag").fill("rain");
  await expect(rows).toHaveCount(0);
  await page.getByRole("button", { name: "Clear tag filter" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Rain");

  // Dashboard: chips on the rows filter projects; text matches tags too.
  await page.goto("/");
  const projects = page.locator(".ph-proj-row");
  await expect(projects).toHaveCount(2);
  await projects.first().getByRole("button", { name: "видео" }).click();
  await expect(projects).toHaveCount(1);
  await expect(projects).toContainText("Clips");
  await page.getByRole("button", { name: "Clear tag filter" }).click();
  await page.getByLabel("Filter projects by name or tag").fill("minimax");
  await expect(projects).toHaveCount(1);
  await expectFitsScreen(page);

  expect(errors).toEqual([]);
});
