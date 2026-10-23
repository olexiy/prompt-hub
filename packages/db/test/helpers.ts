/**
 * Throwaway databases for DB tests. TEST_DATABASE_URL points at a server where the test user may
 * create databases (local Supabase: postgresql://postgres:postgres@127.0.0.1:54322/postgres,
 * CI: the Postgres service). Each test file gets its own database, migrated, and drops it after.
 */
import { uuidv7 } from "@prompt-hub/core";
import postgres from "postgres";
import { createDb } from "../src";
import { runMigrations } from "../src/migrate";

export const ADMIN_URL = process.env.TEST_DATABASE_URL;

export interface TestDb {
  url: string;
  db: ReturnType<typeof createDb>["db"];
  sql: postgres.Sql;
  drop: () => Promise<void>;
}

export async function createTestDb(adminUrl: string): Promise<TestDb> {
  const name = `test_${uuidv7().replace(/-/g, "")}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`create database "${name}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  await runMigrations(url.toString());
  const { db, close } = createDb(url.toString());
  const sql = postgres(url.toString(), { max: 1, onnotice: () => undefined });
  return {
    url: url.toString(),
    db,
    sql,
    drop: async () => {
      await close();
      await sql.end();
      await admin.unsafe(`drop database "${name}" with (force)`);
      await admin.end();
    },
  };
}
