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

test("meta fields: add, show as plain text, remove, reject a bad name (#52)", async ({ page }) => {
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
    await post(`/api/projects/${me.handle}/p/prompts`, { slug: "shot", title: "Shot", body: "x" });
    window.history.pushState(null, "", `/${me.handle}/p/shot`);
    window.dispatchEvent(new Event("popstate"));
  });

  const box = page.getByRole("region", { name: "Meta" });
  await expect(box.getByText("No meta fields yet.")).toBeVisible();
  await box.getByRole("button", { name: "Edit meta fields" }).click();
  await box.getByLabel("Description").fill("Static medium shot");
  await box.getByRole("button", { name: "Add field" }).click();
  await box.getByLabel("Field name").fill("Model");
  await box.getByLabel("Value of Model").fill("MiniMax H3");
  await box.getByRole("button", { name: "Add field" }).click();
  await box.getByLabel("Field name").last().fill("Workflow");
  await box.getByLabel("Value of Workflow").fill("<b>h3_i2v_9s.json</b>");
  await expectFitsScreen(page);
  await box.getByRole("button", { name: "Save" }).click();

  // Built-in first, then custom fields alphabetically; markup stays text.
  await expect(box.locator("dt")).toHaveText(["Description", "Model", "Workflow"]);
  await expect(box.locator("dd")).toHaveText([
    "Static medium shot",
    "MiniMax H3",
    "<b>h3_i2v_9s.json</b>",
  ]);
  await expect(box.locator("dd b")).toHaveCount(0);

  // Survives a reload; removing a field and a bad name.
  await page.reload();
  await expect(box.locator("dt")).toHaveText(["Description", "Model", "Workflow"]);
  await box.getByRole("button", { name: "Edit meta fields" }).click();
  await box.getByRole("button", { name: "Remove field Model" }).click();
  await box.getByRole("button", { name: "Add field" }).click();
  await box.getByLabel("Field name").last().fill("a/b");
  await box.getByLabel("Value of a/b").fill("x");
  await box.getByRole("button", { name: "Save" }).click();
  await expect(box.getByText(/Field name “a\/b” is not allowed/).first()).toBeVisible();
  await box.getByRole("button", { name: "Remove field a/b" }).click();
  await box.getByRole("button", { name: "Save" }).click();
  await expect(box.locator("dt")).toHaveText(["Description", "Workflow"]);

  // A duplicate name is caught before saving too.
  await box.getByRole("button", { name: "Edit meta fields" }).click();
  await box.getByRole("button", { name: "Add field" }).click();
  await box.getByLabel("Field name").last().fill("Workflow");
  await box.getByRole("button", { name: "Save" }).click();
  await expect(box.getByText(/“Workflow” is used twice/).first()).toBeVisible();
  expect(errors).toEqual([]);
});
