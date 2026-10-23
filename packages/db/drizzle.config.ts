import { defineConfig } from "drizzle-kit";

/** `pnpm --filter @prompt-hub/db generate` writes reviewed SQL migrations to ./migrations. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
