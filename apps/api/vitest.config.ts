import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * API tests run inside the Workers runtime (Miniflare) with the real wrangler config, against
 * the local Supabase (Auth + Postgres via the Hyperdrive local connection string).
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    globalSetup: ["./test/global-setup.ts"],
  },
});
