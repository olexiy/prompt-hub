import { defineConfig, devices } from "@playwright/test";

/** Port of its own, so e2e never collides with `pnpm dev` (8787). */
const PORT = 8788;

/**
 * Uses a browser that is already installed instead of downloading Playwright's builds:
 * Microsoft Edge on Windows, Google Chrome on the GitHub runner. Override with E2E_CHANNEL.
 */
const channel = process.env.E2E_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chrome");

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    // The web app must be built first (`pnpm build`); the Worker serves it with the API.
    command: `pnpm --filter @prompt-hub/api exec wrangler dev --port ${String(PORT)} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
