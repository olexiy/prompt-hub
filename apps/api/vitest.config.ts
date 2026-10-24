import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * API tests run inside the Workers runtime (Miniflare) with the real wrangler config, against
 * the local Supabase (Auth + Postgres via the Hyperdrive local connection string).
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    globalSetup: ["./test-setup/global-setup.ts"],
    // Every test signs users in through the local Supabase Auth (bcrypt by design), so many files
    // at once can starve a busy machine; CI has its own runner and keeps the default.
    ...(process.env.CI ? {} : { maxWorkers: 2 }),
  },
});
