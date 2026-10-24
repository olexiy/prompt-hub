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

test("header search: '/' focuses, results with highlights, open a hit, no results (#55)", async ({
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
    const base = `/api/projects/${me.handle}/clips`;
    await post("/api/projects", { slug: "clips", name: "Clips" });
    await post(`${base}/folders`, { slug: "rain", name: "Rain" });
    await post(`${base}/prompts`, {
      folder: ["rain"],
      slug: "girl",
      title: "Девушка на остановке",
      body: "Девушка ждёт автобус под дождём, <b>свет</b> фонарей.",
    });
    await post(`${base}/prompts`, { slug: "letter", title: "Brief", body: "Liebe Oma" });
    return me.handle;
  });

  // "/" focuses the box; Enter opens the results page.
  await page.keyboard.press("/");
  const box = page.getByRole("searchbox", { name: "Search prompts, tags…" });
  await expect(box).toBeFocused();
  await box.fill("дожд");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=%D0%B4%D0%BE%D0%B6%D0%B4$/);
  await expect(page.getByRole("heading", { name: "Results for “дожд”" })).toBeVisible();
  const prompts = page.getByRole("region", { name: "Prompts" });
  await expect(prompts.getByRole("link")).toHaveText(["Девушка на остановке"]);
  await expect(prompts.locator("mark")).toContainText(["дождём"]);
  // Markup in the prompt text never renders: ts_headline drops tag-like parts from the excerpt.
  const snippet = prompts.locator(".ph-search-snippet");
  await expect(snippet).toContainText("свет");
  await expect(snippet.locator("b")).toHaveCount(0);
  await expect(box).toHaveValue("дожд");
  await expectFitsScreen(page);

  // A new query from the results page, then open a hit.
  await box.fill("oma");
  await box.press("Enter");
  await expect(prompts.getByRole("link")).toHaveText(["Brief"]);
  await box.fill("девушка");
  await box.press("Enter");
  await prompts.getByRole("link", { name: "Девушка на остановке" }).click();
  await expect(page).toHaveURL(new RegExp(`/${handle}/clips/rain/girl$`));
  await expect(page.getByRole("heading", { name: "Девушка на остановке" })).toBeVisible();
  await expect(box).toHaveValue("");

  await page.goto("/search?q=nothing-like-this");
  await expect(
    page.getByText("Nothing found for “nothing-like-this”.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
