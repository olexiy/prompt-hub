import { uuidv7 } from "@prompt-hub/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appUser,
  folder,
  planLimit,
  project,
  prompt,
  promptVersion,
  tag,
  projectTag,
} from "../src";
import { runMigrations } from "../src/migrate";
import { ADMIN_URL, createTestDb, type TestDb } from "./helpers";

/** Postgres error code of a failed query, e.g. 23505 unique_violation, 23514 check_violation. */
async function pgCode(query: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await query;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.code ?? err.cause?.code;
  }
}

describe.skipIf(!ADMIN_URL)("schema v0", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await createTestDb(ADMIN_URL ?? "");
  }, 60_000);

  afterAll(async () => {
    await t.drop();
  });

  async function newUser(handle = `u${String(Date.now())}${String(Math.random()).slice(2, 6)}`) {
    const [u] = await t.db.insert(appUser).values({ id: uuidv7(), handle }).returning();
    if (!u) throw new Error("user not created");
    return u;
  }

  it("migrations are idempotent", async () => {
    await expect(runMigrations(t.url)).resolves.toBeUndefined();
  });

  it("seeds plan limits", async () => {
    const rows = await t.db.select().from(planLimit).orderBy(planLimit.plan);
    expect(rows).toEqual([
      { plan: "FREE", maxProjects: 25, maxPrompts: 250 },
      { plan: "PRO", maxProjects: null, maxPrompts: null },
    ]);
  });

  it("enables row level security on every table", async () => {
    const rows = await t.sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname not like '__drizzle%'`;
    expect(rows.length).toBe(10);
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });

  it("generates UUIDv7 ids and keeps project slugs unique per owner", async () => {
    const a = await newUser();
    const b = await newUser();
    const [p] = await t.db
      .insert(project)
      .values({ ownerId: a.id, slug: "comfy-h3", name: "Comfy H3" })
      .returning();
    expect(p?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(
      await pgCode(t.db.insert(project).values({ ownerId: a.id, slug: "comfy-h3", name: "Again" })),
    ).toBe("23505");
    // Another user may use the same slug.
    expect(
      await pgCode(t.db.insert(project).values({ ownerId: b.id, slug: "comfy-h3", name: "Mine" })),
    ).toBeUndefined();
  });

  it("rejects invalid slugs, visibility and oversized text in the database", async () => {
    const u = await newUser();
    const bad = [
      { ownerId: u.id, slug: "Bad Slug", name: "x" },
      { ownerId: u.id, slug: "../etc", name: "x" },
      { ownerId: u.id, slug: "ok", name: "x", visibility: "SECRET" },
      { ownerId: u.id, slug: "ok2", name: "" },
    ];
    for (const values of bad) {
      expect(await pgCode(t.db.insert(project).values(values))).toBe("23514");
    }
  });

  it("treats a missing folder as one namespace for prompt slugs", async () => {
    const u = await newUser();
    const [p] = await t.db
      .insert(project)
      .values({ ownerId: u.id, slug: "p", name: "P" })
      .returning();
    if (!p) throw new Error("project not created");
    await t.db.insert(prompt).values({ projectId: p.id, slug: "same", title: "A" });
    expect(
      await pgCode(t.db.insert(prompt).values({ projectId: p.id, slug: "same", title: "B" })),
    ).toBe("23505");
  });

  it("deleting a project removes its folders, prompts, versions and tag links", async () => {
    const u = await newUser();
    const [p] = await t.db
      .insert(project)
      .values({ ownerId: u.id, slug: "del", name: "Del" })
      .returning();
    if (!p) throw new Error("project not created");
    const [f] = await t.db
      .insert(folder)
      .values({ projectId: p.id, slug: "f", name: "F" })
      .returning();
    const [pr] = await t.db
      .insert(prompt)
      .values({ projectId: p.id, folderId: f?.id ?? null, slug: "x", title: "X" })
      .returning();
    if (!pr) throw new Error("prompt not created");
    const [v] = await t.db
      .insert(promptVersion)
      .values({ promptId: pr.id, number: 1, body: "Hello {{name}}", variables: [{ name: "name" }] })
      .returning();
    await t.db
      .update(prompt)
      .set({ currentVersionId: v?.id ?? null })
      .where(eq(prompt.id, pr.id));
    const [tg] = await t.db.insert(tag).values({ ownerId: u.id, name: "comfyui" }).returning();
    await t.db.insert(projectTag).values({ projectId: p.id, tagId: tg?.id ?? "" });

    await t.db.delete(project).where(eq(project.id, p.id));

    expect(await t.db.select().from(folder).where(eq(folder.projectId, p.id))).toEqual([]);
    expect(await t.db.select().from(prompt).where(eq(prompt.projectId, p.id))).toEqual([]);
    expect(
      await t.db.select().from(promptVersion).where(eq(promptVersion.promptId, pr.id)),
    ).toEqual([]);
    expect(await t.db.select().from(projectTag).where(eq(projectTag.projectId, p.id))).toEqual([]);
    // The tag itself belongs to the user and stays.
    expect(await t.db.select().from(tag).where(eq(tag.ownerId, u.id))).toHaveLength(1);
  });

  it("deleting the live version clears prompt.current_version_id", async () => {
    const u = await newUser();
    const [p] = await t.db
      .insert(project)
      .values({ ownerId: u.id, slug: "v", name: "V" })
      .returning();
    const [pr] = await t.db
      .insert(prompt)
      .values({ projectId: p?.id ?? "", slug: "x", title: "X" })
      .returning();
    const [v] = await t.db
      .insert(promptVersion)
      .values({ promptId: pr?.id ?? "", number: 1, body: "b" })
      .returning();
    await t.db
      .update(prompt)
      .set({ currentVersionId: v?.id ?? null })
      .where(eq(prompt.id, pr?.id ?? ""));
    await t.db.delete(promptVersion).where(eq(promptVersion.id, v?.id ?? ""));
    const [after] = await t.db
      .select()
      .from(prompt)
      .where(eq(prompt.id, pr?.id ?? ""));
    expect(after?.currentVersionId).toBeNull();
  });

  it("finds prompt text with full-text search in any language", async () => {
    const u = await newUser();
    const [p] = await t.db
      .insert(project)
      .values({ ownerId: u.id, slug: "s", name: "S" })
      .returning();
    const [pr] = await t.db
      .insert(prompt)
      .values({ projectId: p?.id ?? "", slug: "x", title: "X" })
      .returning();
    await t.db.insert(promptVersion).values([
      { promptId: pr?.id ?? "", number: 1, body: "copper-red hair at a bus stop" },
      { promptId: pr?.id ?? "", number: 2, body: "Рыжие волосы на остановке, Größe egal" },
    ]);
    const hits = async (q: string) =>
      (
        await t.sql`select number from prompt_version where search @@ plainto_tsquery('simple', ${q}) order by number`
      ).map((r) => r.number as number);
    expect(await hits("bus stop")).toEqual([1]);
    expect(await hits("остановке")).toEqual([2]);
    expect(await hits("größe")).toEqual([2]);
  });
});
