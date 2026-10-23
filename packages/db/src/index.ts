/** Database access for the API: schema, client factory and migrations. */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
// Re-exported so every package uses the one drizzle-orm instance resolved here.
export { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
export { schema };

/**
 * Drizzle client for one request (or one test). On Workers the connection string comes from the
 * Hyperdrive binding, which pools the real database connections; options follow Cloudflare's
 * Hyperdrive + postgres.js guide. Workers code does not call `close()` (the guide doesn't
 * either: ending the socket mid-request leaves a rejected read in the runtime); Node callers do.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: true });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export type Db = ReturnType<typeof createDb>["db"];
