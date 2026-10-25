import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Visual regression (#37): screenshots of the main screens compared with baselines in
 * `visual/__screenshots__`. Baselines depend on the OS, browser and fonts, so they are kept per
 * platform and the check runs locally (`corepack pnpm visual`); `visual:update` rewrites them.
 */
// The visual spec makes its own fixed user, so the e2e global setup is left out.
const shared = { ...base };
delete shared.globalSetup;

export default defineConfig({
  ...shared,
  testDir: "./visual",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    // Runs on one machine are pixel-identical; a few pixels of slack only for antialiasing noise.
    toHaveScreenshot: { maxDiffPixels: 20, animations: "disabled", caret: "hide" },
  },
});
