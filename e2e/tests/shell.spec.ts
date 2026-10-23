import { expect, test, type Page } from "@playwright/test";
import { createUser, ownClientIp, type TestUser } from "./users";

let user: TestUser;
test.beforeEach(async () => {
  user = await createUser();
});
test.afterEach(async () => {
  await user.remove();
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function signIn(page: Page) {
  await ownClientIp(page);
  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
}

/** Primer's ThemeProvider marks its element with the active mode. */
const colorMode = (page: Page) =>
  page.locator("[data-color-mode]").first().getAttribute("data-color-mode");

test("language and theme switch, persist across reloads and sessions", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);

  // Settings via the account menu.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByLabel("Language").selectOption("ru");
  await page.getByLabel("Dark").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await expect(page.getByRole("heading", { name: "Внешний вид" })).toBeVisible();
  expect(await colorMode(page)).toBe("dark");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ru");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Внешний вид" })).toBeVisible();
  expect(await colorMode(page)).toBe("dark");

  // The header toggle cycles dark → system and saves too.
  await page.getByRole("button", { name: /Сменить тему/ }).click();
  await expect(page.getByRole("button", { name: /Тема: Системная/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Тема: Системная/ })).toBeVisible();
  expect(await colorMode(page)).toBe("auto");

  // Stored on the user, not in the browser: a fresh context gets the same language.
  const other = await page.context().browser()?.newPage();
  if (other) {
    await ownClientIp(other);
    await other.goto("/");
    await other.getByLabel("Email address").fill(user.email);
    await other.getByLabel("Password").fill(user.password);
    await other.getByRole("button", { name: "Sign in" }).click();
    await expect(other.getByRole("heading", { name: "Проектов пока нет" })).toBeVisible();
    await other.close();
  }
  expect(errors).toEqual([]);
});

test("GitHub-like URLs render the shell with breadcrumbs; unknown paths say not found", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await signIn(page);

  // An own project, created through the API as the page would.
  const handle = await page.evaluate(async () => {
    const me = (await (await fetch("/api/me")).json()) as { handle: string };
    await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "comfy-h3", name: "Comfy H3" }),
    });
    return me.handle;
  });

  // Folders come later: a deeper path is a placeholder inside the shell.
  await page.goto(`/${handle}/comfy-h3/shots/bus-stop-9s`);
  await expect(page.getByRole("heading", { name: "Coming soon" })).toBeVisible();
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
  if (await crumb.isVisible()) {
    await expect(crumb.getByRole("link")).toHaveText([handle, "comfy-h3", "shots", "bus-stop-9s"]);
    await crumb.getByRole("link", { name: "comfy-h3" }).click();
    await expect(page).toHaveURL(new RegExp(`/${handle}/comfy-h3$`));
    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
  }

  await page.goto("/Not_A_Slug");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to your projects" }).click();
  await expect(page.getByRole("link", { name: "Comfy H3" })).toBeVisible();
  expect(errors).toEqual([]);
});
