import { expect, test } from "@playwright/test";

/** Headers set by apps/web/public/_headers on the static app (HTML and assets). */
test("the HTML page carries the security headers and a strict CSP", async ({ request }) => {
  for (const path of ["/", "/olexiy/some-project"]) {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const h = res.headers();
    const csp = h["content-security-policy"] ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["strict-transport-security"]).toContain("max-age=");
  }
});

test("API responses carry the API headers", async ({ request }) => {
  const h = (await request.get("/api/health")).headers();
  expect(h["content-security-policy"]).toContain("default-src 'none'");
  expect(h["cache-control"]).toBe("no-store");
});

test("the app runs under the CSP without violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || /Content Security Policy/i.test(msg.text())) {
      problems.push(msg.text());
    }
  });
  page.on("pageerror", (err) => problems.push(err.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Prompt Hub" })).toBeVisible();
  // Open the reset form too, so more components render under the policy.
  await page.getByRole("button", { name: /forgot/i }).click();
  await page.waitForLoadState("networkidle");
  expect(problems).toEqual([]);
});
