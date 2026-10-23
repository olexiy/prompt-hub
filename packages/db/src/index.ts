/** Database access for the API: schema, client factory and migrations. */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

/**
 * Drizzle client for one request. On Workers the connection string comes from the Hyperdrive
 * binding (#21), which pools connections, so a small client per request is the intended use.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: true });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export type Db = ReturnType<typeof createDb>["db"];
