/**
 * Applies pending SQL migrations from ./migrations to DATABASE_URL.
 * Used by `pnpm db:migrate`, the deploy pipeline (#21) and the DB tests.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

/** Run all pending migrations; safe to call repeatedly. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await client.end();
  }
}

// Run as a script (`pnpm db:migrate`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("Migrations applied.");
}
