/**
 * /api/projects/* — projects, folders and prompts of the signed-in user (#40, folders #48).
 *
 * Items are addressed by path like the web URLs: `/:handle/:project/path/<folder…>/<prompt>`.
 * A folder and a prompt never share a slug in the same parent, so a path is unambiguous.
 *
 * Authorisation: every query is scoped by the signed-in owner. A `:handle` that is not the
 * signed-in user's, or a project/item they do not own, answers 404 — the same as "does not
 * exist", so nothing leaks. Public reads by other users come with #53.
 *
 * Lifecycle (#51): project settings (rename, new slug, description, archive), final project
 * delete (cascades), prompt duplicate. A changed slug is not redirected: old URLs answer 404.
 */
import {
  folderCreateSchema,
  isValidSlug,
  itemPatchSchema,
  MAX_ITEM_DEPTH,
  projectCreateSchema,
  projectPatchSchema,
  promptCopySchema,
  promptCreateSchema,
  syncDefinitions,
  versionContentSchema,
  versionCreateSchema,
  type FolderListing,
  type ProjectSummary,
  type PromptDetail,
  type VersionDetail,
  type VersionSummary,
  type Visibility,
} from "@prompt-hub/core";
import {
  and,
  asc,
  desc,
  eq,
  folder,
  isNotNull,
  isNull,
  ne,
  project,
  prompt,
  promptVersion,
  sql,
  type Db,
} from "@prompt-hub/db";
import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { requireUser } from "../auth/middleware";
import { parseJson } from "../security/validate";

/** True for a Postgres unique violation anywhere in the error's cause chain (drizzle wraps it). */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

const notFound = (c: Context<AppEnv>) => c.json({ error: "Not found" }, 404);
const nameTaken = (c: Context<AppEnv>) =>
  c.json({ error: "This folder already has a prompt or folder with this URL slug" }, 409);

/** Variable definitions without undefined keys: what we store and return (typed variables later). */
function cleanDefs(
  defs: readonly { name: string; default?: string | undefined; description?: string | undefined }[],
): { name: string; default?: string; description?: string }[] {
  return defs.map(({ name, default: d, description }) => ({
    name,
    ...(d === undefined ? {} : { default: d }),
    ...(description === undefined ? {} : { description }),
  }));
}

// Written with explicit table names: inside a subquery drizzle's column refs are unqualified, so
// "id" would resolve to prompt.id instead of the outer project.id.
const promptCount = sql<number>`(select count(*)::int from "prompt" where "prompt"."project_id" = "project"."id")`;

const summaryColumns = {
  id: project.id,
  slug: project.slug,
  name: project.name,
  description: project.description,
  visibility: project.visibility,
  archivedAt: project.archivedAt,
  promptCount,
  updatedAt: project.updatedAt,
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: string;
  archivedAt: Date | null;
  promptCount: number;
  updatedAt: Date;
};

function toSummary(row: Omit<ProjectRow, "id">): ProjectSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility as Visibility,
    archived: row.archivedAt !== null,
    promptCount: row.promptCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The signed-in user's project named in the URL, or null (wrong handle, missing, not theirs). */
async function ownProject(c: Context<AppEnv>): Promise<ProjectRow | null> {
  const user = c.get("user");
  if (c.req.param("handle") !== user.handle) return null;
  const [row] = await c
    .get("db")
    .select(summaryColumns)
    .from(project)
    .where(and(eq(project.ownerId, user.id), eq(project.slug, c.req.param("project") ?? "")));
  return row ?? null;
}

/**
 * Segments after `/<marker>/` (`path` or `versions`) behind the project slug; null when a segment
 * is not a slug or the path is too deep.
 */
function pathSegments(c: Context<AppEnv>, marker = "/path"): string[] | null {
  const projectAt = c.req.path.indexOf(`/${c.req.param("project") ?? ""}/`);
  const start = c.req.path.indexOf(`${marker}/`, projectAt);
  if (projectAt < 0 || start < 0) return null;
  const raw = c.req.path.slice(start + marker.length);
  const segments = raw.split("/").filter((s) => s !== "");
  if (segments.length > MAX_ITEM_DEPTH || !segments.every(isValidSlug)) return null;
  return segments;
}

const parentIs = (parentId: string | null) =>
  parentId === null ? isNull(folder.parentId) : eq(folder.parentId, parentId);
const inFolder = (folderId: string | null) =>
  folderId === null ? isNull(prompt.folderId) : eq(prompt.folderId, folderId);

/** Folder id for a folder path (null = project root), or undefined when it does not exist. */
async function findFolder(
  db: Db,
  projectId: string,
  path: readonly string[],
): Promise<{ id: string | null; name: string | null } | undefined> {
  let current: { id: string | null; name: string | null } = { id: null, name: null };
  for (const slug of path) {
    const [row] = await db
      .select({ id: folder.id, name: folder.name })
      .from(folder)
      .where(and(eq(folder.projectId, projectId), parentIs(current.id), eq(folder.slug, slug)));
    if (!row) return undefined;
    current = row;
  }
  return current;
}

async function slugUsedByFolder(db: Db, projectId: string, parentId: string | null, slug: string) {
  const rows = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.projectId, projectId), parentIs(parentId), eq(folder.slug, slug)));
  return rows.length > 0;
}

async function slugUsedByPrompt(db: Db, projectId: string, folderId: string | null, slug: string) {
  const rows = await db
    .select({ id: prompt.id })
    .from(prompt)
    .where(and(eq(prompt.projectId, projectId), inFolder(folderId), eq(prompt.slug, slug)));
  return rows.length > 0;
}

async function listing(
  c: Context<AppEnv>,
  proj: ProjectRow,
  path: string[],
  dir: { id: string | null; name: string | null },
): Promise<FolderListing> {
  const db = c.get("db");
  const [folders, prompts] = await Promise.all([
    db
      .select({ slug: folder.slug, name: folder.name })
      .from(folder)
      .where(and(eq(folder.projectId, proj.id), parentIs(dir.id)))
      .orderBy(asc(folder.name)),
    db
      .select({ slug: prompt.slug, title: prompt.title, updatedAt: prompt.updatedAt })
      .from(prompt)
      .where(and(eq(prompt.projectId, proj.id), inFolder(dir.id)))
      .orderBy(asc(prompt.title)),
  ]);
  return {
    kind: "folder",
    project: toSummary(proj),
    owner: c.get("user").handle,
    path,
    name: dir.name ?? proj.name,
    folders,
    prompts: prompts.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
  };
}

// Explicit names for the same reason as promptCount.
const versionCount = sql<number>`(select count(*)::int from "prompt_version" where "prompt_version"."prompt_id" = "prompt"."id")`;

/** The prompt at `folderPath/slug` with its current version, or null. */
async function promptAt(db: Db, projectId: string, folderId: string | null, slug: string) {
  const [row] = await db
    .select({
      id: prompt.id,
      slug: prompt.slug,
      title: prompt.title,
      meta: prompt.meta,
      updatedAt: prompt.updatedAt,
      versionId: promptVersion.id,
      number: promptVersion.number,
      body: promptVersion.body,
      variables: promptVersion.variables,
      message: promptVersion.message,
      createdAt: promptVersion.createdAt,
      versionCount,
    })
    .from(prompt)
    .innerJoin(promptVersion, eq(promptVersion.id, prompt.currentVersionId))
    .where(and(eq(prompt.projectId, projectId), inFolder(folderId), eq(prompt.slug, slug)));
  return row ?? null;
}

function toPromptDetail(
  row: NonNullable<Awaited<ReturnType<typeof promptAt>>>,
  folderPath: string[],
): PromptDetail {
  return {
    kind: "prompt",
    folder: folderPath,
    slug: row.slug,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    versionCount: row.versionCount,
    meta: row.meta,
    version: {
      number: row.number,
      body: row.body,
      variables: cleanDefs(row.variables),
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

/** What a path points at: a folder (also the root) or a prompt. */
async function resolve(c: Context<AppEnv>, proj: ProjectRow, path: string[]) {
  const db = c.get("db");
  const dir = await findFolder(db, proj.id, path);
  if (dir) return { kind: "folder" as const, path, dir };
  const parentPath = path.slice(0, -1);
  const slug = path.at(-1);
  const parent = await findFolder(db, proj.id, parentPath);
  if (!parent || !slug) return null;
  const row = await promptAt(db, proj.id, parent.id, slug);
  return row ? { kind: "prompt" as const, parentPath, parentId: parent.id, row } : null;
}

/** Marks the project as changed; takes the db or a transaction. */
/** The prompt a `/versions/<path>` URL names, or null (also for folders). */
async function versionedPrompt(c: Context<AppEnv>) {
  const proj = await ownProject(c);
  const path = pathSegments(c, "/versions");
  if (!proj || !path || path.length === 0) return null;
  const item = await resolve(c, proj, path);
  return item?.kind === "prompt" ? { proj, item } : null;
}

const touchProject = (db: Pick<Db, "update">, projectId: string) =>
  db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, projectId));

export const projectRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .get("/", async (c) => {
    // `?archived=1` lists the archived projects instead of the active ones.
    const archived = c.req.query("archived") === "1";
    const rows = await c
      .get("db")
      .select(summaryColumns)
      .from(project)
      .where(
        and(
          eq(project.ownerId, c.get("user").id),
          archived ? isNotNull(project.archivedAt) : isNull(project.archivedAt),
        ),
      )
      .orderBy(desc(project.updatedAt));
    return c.json({ projects: rows.map(toSummary) });
  })
  .post("/", async (c) => {
    const input = await parseJson(c, projectCreateSchema, "Check the project name and URL slug");
    try {
      const [row] = await c
        .get("db")
        .insert(project)
        .values({ ownerId: c.get("user").id, ...input })
        .returning();
      if (!row) throw new Error("project insert returned nothing");
      return c.json(toSummary({ ...row, promptCount: 0 }), 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "You already have a project with this URL slug" }, 409);
      }
      throw err;
    }
  })
  .get("/:handle/:project", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    return c.json(await listing(c, proj, [], { id: null, name: null }));
  })
  .patch("/:handle/:project", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const { archived, ...fields } = await parseJson(
      c,
      projectPatchSchema,
      "Check the project settings",
    );
    const changes = {
      ...fields,
      ...(archived === undefined
        ? {}
        : { archivedAt: archived ? (proj.archivedAt ?? new Date()) : null }),
    };
    try {
      const [row] = await c
        .get("db")
        .update(project)
        .set(changes)
        .where(eq(project.id, proj.id))
        .returning();
      if (!row) return notFound(c);
      return c.json(toSummary({ ...row, promptCount: proj.promptCount }));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "You already have a project with this URL slug" }, 409);
      }
      throw err;
    }
  })
  .delete("/:handle/:project", async (c) => {
    // Final (feature 15): folders, prompts, versions and tags go with it by cascade. The web app
    // asks to type the project name first.
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    await c.get("db").delete(project).where(eq(project.id, proj.id));
    return c.body(null, 204);
  })
  .get("/:handle/:project/path/*", async (c) => {
    const proj = await ownProject(c);
    const path = pathSegments(c);
    if (!proj || !path) return notFound(c);
    const item = await resolve(c, proj, path);
    if (!item) return notFound(c);
    return c.json(
      item.kind === "folder"
        ? await listing(c, proj, path, item.dir)
        : toPromptDetail(item.row, item.parentPath),
    );
  })
  .get("/:handle/:project/folders", async (c) => {
    // Every folder as a path, for "move to" pickers; built in memory (projects are small).
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const rows = await c
      .get("db")
      .select({ id: folder.id, parentId: folder.parentId, slug: folder.slug, name: folder.name })
      .from(folder)
      .where(eq(folder.projectId, proj.id));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const pathOf = (r: (typeof rows)[number]): string[] => {
      const parent = r.parentId ? byId.get(r.parentId) : undefined;
      return parent ? [...pathOf(parent), r.slug] : [r.slug];
    };
    const folders = rows
      .map((r) => ({ path: pathOf(r), name: r.name }))
      .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
    return c.json({ folders });
  })
  .post("/:handle/:project/folders", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const input = await parseJson(c, folderCreateSchema, "Check the folder name and URL slug");
    const db = c.get("db");
    const parent = await findFolder(db, proj.id, input.parent);
    if (!parent) return notFound(c);
    if (input.parent.length + 1 >= MAX_ITEM_DEPTH) {
      return c.json({ error: "Folders cannot be nested deeper" }, 400);
    }
    if (await slugUsedByPrompt(db, proj.id, parent.id, input.slug)) return nameTaken(c);
    try {
      await db
        .insert(folder)
        .values({ projectId: proj.id, parentId: parent.id, slug: input.slug, name: input.name });
    } catch (err) {
      if (isUniqueViolation(err)) return nameTaken(c);
      throw err;
    }
    await touchProject(db, proj.id);
    const path = [...input.parent, input.slug];
    const dir = await findFolder(db, proj.id, path);
    if (!dir) throw new Error("folder missing after insert");
    return c.json(await listing(c, proj, path, dir), 201);
  })
  .post("/:handle/:project/prompts", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const input = await parseJson(c, promptCreateSchema, "Check the title, URL slug and text");
    const db = c.get("db");
    const parent = await findFolder(db, proj.id, input.folder);
    if (!parent) return notFound(c);
    if (await slugUsedByFolder(db, proj.id, parent.id, input.slug)) return nameTaken(c);
    const variables = cleanDefs(syncDefinitions(input.body, input.variables));
    const userId = c.get("user").id;
    try {
      await db.transaction(async (tx) => {
        const [p] = await tx
          .insert(prompt)
          .values({
            projectId: proj.id,
            folderId: parent.id,
            slug: input.slug,
            title: input.title,
            lastVersionNumber: 1,
          })
          .returning();
        if (!p) throw new Error("prompt insert returned nothing");
        const [v] = await tx
          .insert(promptVersion)
          .values({ promptId: p.id, number: 1, body: input.body, variables, createdBy: userId })
          .returning();
        if (!v) throw new Error("version insert returned nothing");
        await tx.update(prompt).set({ currentVersionId: v.id }).where(eq(prompt.id, p.id));
        await touchProject(tx, proj.id);
      });
    } catch (err) {
      if (isUniqueViolation(err)) return nameTaken(c);
      throw err;
    }
    const row = await promptAt(db, proj.id, parent.id, input.slug);
    if (!row) throw new Error("prompt missing after insert");
    return c.json(toPromptDetail(row, input.folder), 201);
  })
  .patch("/:handle/:project/path/*", async (c) => {
    const proj = await ownProject(c);
    const path = pathSegments(c);
    if (!proj || !path || path.length === 0) return notFound(c);
    const change = await parseJson(c, itemPatchSchema, "Invalid change");
    const db = c.get("db");
    const item = await resolve(c, proj, path);
    if (!item) return notFound(c);

    if (item.kind === "folder" && change.name !== undefined && item.dir.id) {
      await db.update(folder).set({ name: change.name }).where(eq(folder.id, item.dir.id));
      return c.json(await listing(c, proj, path, { ...item.dir, name: change.name }));
    }
    if (item.kind === "prompt" && change.to !== undefined) {
      const target = await findFolder(db, proj.id, change.to);
      if (!target) return notFound(c);
      if (await slugUsedByFolder(db, proj.id, target.id, item.row.slug)) return nameTaken(c);
      try {
        await db.update(prompt).set({ folderId: target.id }).where(eq(prompt.id, item.row.id));
      } catch (err) {
        if (isUniqueViolation(err)) return nameTaken(c);
        throw err;
      }
      return c.json(toPromptDetail(item.row, change.to));
    }
    if (item.kind === "prompt" && change.title !== undefined) {
      await db.update(prompt).set({ title: change.title }).where(eq(prompt.id, item.row.id));
      return c.json(toPromptDetail({ ...item.row, title: change.title }, item.parentPath));
    }
    if (item.kind === "prompt" && change.meta !== undefined) {
      // Replaces the whole map; values are stored as plain text and returned as such.
      await db
        .update(prompt)
        .set({ meta: change.meta, updatedAt: new Date() })
        .where(eq(prompt.id, item.row.id));
      return c.json(toPromptDetail({ ...item.row, meta: change.meta }, item.parentPath));
    }
    if (item.kind === "prompt" && change.slug !== undefined) {
      if (await slugUsedByFolder(db, proj.id, item.parentId, change.slug)) return nameTaken(c);
      try {
        await db.update(prompt).set({ slug: change.slug }).where(eq(prompt.id, item.row.id));
      } catch (err) {
        if (isUniqueViolation(err)) return nameTaken(c);
        throw err;
      }
      return c.json(toPromptDetail({ ...item.row, slug: change.slug }, item.parentPath));
    }
    return c.json({ error: "Invalid change" }, 400);
  })
  .delete("/:handle/:project/path/*", async (c) => {
    const proj = await ownProject(c);
    const path = pathSegments(c);
    if (!proj || !path || path.length === 0) return notFound(c);
    const db = c.get("db");
    const item = await resolve(c, proj, path);
    if (!item) return notFound(c);
    // Deletes are final (feature 15); folders take their subfolders and prompts with them.
    if (item.kind === "folder" && item.dir.id) {
      await db.delete(folder).where(eq(folder.id, item.dir.id));
    } else if (item.kind === "prompt") {
      await db.delete(prompt).where(eq(prompt.id, item.row.id));
    }
    await touchProject(db, proj.id);
    return c.body(null, 204);
  })
  .post("/:handle/:project/copy/*", async (c) => {
    // Duplicate a prompt next to the original: its current version becomes v1 of the copy.
    const proj = await ownProject(c);
    const path = pathSegments(c, "/copy");
    if (!proj || !path || path.length === 0) return notFound(c);
    const input = await parseJson(c, promptCopySchema, "Check the title and URL slug");
    const db = c.get("db");
    const item = await resolve(c, proj, path);
    if (item?.kind !== "prompt") return notFound(c);
    const { parentId, parentPath, row: source } = item;
    if (await slugUsedByFolder(db, proj.id, parentId, input.slug)) return nameTaken(c);
    const [meta] = await db
      .select({ meta: prompt.meta, type: prompt.type })
      .from(prompt)
      .where(eq(prompt.id, source.id));
    try {
      await db.transaction(async (tx) => {
        const [p] = await tx
          .insert(prompt)
          .values({
            projectId: proj.id,
            folderId: parentId,
            slug: input.slug,
            title: input.title,
            type: meta?.type ?? "TEXT",
            meta: meta?.meta ?? {},
            lastVersionNumber: 1,
          })
          .returning();
        if (!p) throw new Error("prompt insert returned nothing");
        const [v] = await tx
          .insert(promptVersion)
          .values({
            promptId: p.id,
            number: 1,
            body: source.body,
            variables: cleanDefs(source.variables),
            message: `Copied from ${source.slug} v${String(source.number)}`,
            createdBy: c.get("user").id,
          })
          .returning();
        if (!v) throw new Error("version insert returned nothing");
        await tx.update(prompt).set({ currentVersionId: v.id }).where(eq(prompt.id, p.id));
        await touchProject(tx, proj.id);
      });
    } catch (err) {
      if (isUniqueViolation(err)) return nameTaken(c);
      throw err;
    }
    const row = await promptAt(db, proj.id, parentId, input.slug);
    if (!row) throw new Error("prompt missing after copy");
    return c.json(toPromptDetail(row, parentPath), 201);
  })
  .get("/:handle/:project/versions/*", async (c) => {
    // `?n=` reads one version; otherwise the history, newest first.
    const found = await versionedPrompt(c);
    if (!found) return notFound(c);
    const db = c.get("db");
    const n = c.req.query("n");
    if (n !== undefined) {
      const number = Number(n);
      if (!Number.isInteger(number) || number < 1) return notFound(c);
      const [v] = await db
        .select()
        .from(promptVersion)
        .where(
          and(eq(promptVersion.promptId, found.item.row.id), eq(promptVersion.number, number)),
        );
      if (!v) return notFound(c);
      const detail: VersionDetail = {
        number: v.number,
        body: v.body,
        variables: cleanDefs(v.variables),
        message: v.message,
        createdAt: v.createdAt.toISOString(),
      };
      return c.json(detail);
    }
    const rows = await db
      .select({
        id: promptVersion.id,
        number: promptVersion.number,
        message: promptVersion.message,
        createdAt: promptVersion.createdAt,
      })
      .from(promptVersion)
      .where(eq(promptVersion.promptId, found.item.row.id))
      .orderBy(desc(promptVersion.number));
    const versions: VersionSummary[] = rows.map((r) => ({
      number: r.number,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      current: r.id === found.item.row.versionId,
    }));
    return c.json({ versions });
  })
  .post("/:handle/:project/versions/*", async (c) => {
    // A new current version: the edited state, or an old version restored as the newest.
    const found = await versionedPrompt(c);
    if (!found) return notFound(c);
    const input = await parseJson(c, versionCreateSchema, "Check the prompt text and variables");
    const db = c.get("db");
    const promptId = found.item.row.id;
    let content: { body: string; variables: ReturnType<typeof cleanDefs>; message: string };
    if ("restore" in input) {
      const [old] = await db
        .select()
        .from(promptVersion)
        .where(and(eq(promptVersion.promptId, promptId), eq(promptVersion.number, input.restore)));
      if (!old) return notFound(c);
      content = {
        body: old.body,
        variables: cleanDefs(old.variables),
        message: `Restored v${String(old.number)}`,
      };
    } else {
      // Versions carry no user message; only restores get an automatic label.
      content = {
        body: input.body,
        variables: cleanDefs(syncDefinitions(input.body, input.variables)),
        message: "",
      };
    }
    try {
      await db.transaction(async (tx) => {
        // The counter on the prompt row hands out numbers: never reused after deletes, and the
        // row lock serialises two saves of the same prompt.
        const [counter] = await tx
          .update(prompt)
          .set({ lastVersionNumber: sql`${prompt.lastVersionNumber} + 1` })
          .where(eq(prompt.id, promptId))
          .returning({ n: prompt.lastVersionNumber });
        if (!counter) throw new Error("prompt missing while saving");
        const [v] = await tx
          .insert(promptVersion)
          .values({
            promptId,
            number: counter.n,
            ...content,
            createdBy: c.get("user").id,
          })
          .returning({ id: promptVersion.id });
        if (!v) throw new Error("version insert returned nothing");
        await tx
          .update(prompt)
          .set({ currentVersionId: v.id, updatedAt: new Date() })
          .where(eq(prompt.id, promptId));
        await touchProject(tx, found.proj.id);
      });
    } catch (err) {
      // Two saves at the same moment picked the same number.
      if (isUniqueViolation(err)) {
        return c.json({ error: "Saved at the same time elsewhere. Reload and try again." }, 409);
      }
      throw err;
    }
    const row = await promptAt(db, found.proj.id, found.item.parentId, found.item.row.slug);
    if (!row) throw new Error("prompt missing after save");
    return c.json(toPromptDetail(row, found.item.parentPath), 201);
  })
  .put("/:handle/:project/versions/*", async (c) => {
    // A plain save: the current version is edited in place, its number and the count stay.
    const found = await versionedPrompt(c);
    if (!found) return notFound(c);
    const input = await parseJson(c, versionContentSchema, "Check the prompt text and variables");
    const db = c.get("db");
    await db.transaction(async (tx) => {
      await tx
        .update(promptVersion)
        .set({
          body: input.body,
          variables: cleanDefs(syncDefinitions(input.body, input.variables)),
        })
        .where(eq(promptVersion.id, found.item.row.versionId));
      await tx
        .update(prompt)
        .set({ updatedAt: new Date() })
        .where(eq(prompt.id, found.item.row.id));
      await touchProject(tx, found.proj.id);
    });
    const row = await promptAt(db, found.proj.id, found.item.parentId, found.item.row.slug);
    if (!row) throw new Error("prompt missing after save");
    return c.json(toPromptDetail(row, found.item.parentPath));
  })
  .delete("/:handle/:project/versions/*", async (c) => {
    // Deletes one version for good (feature 73); the last remaining version cannot go.
    const found = await versionedPrompt(c);
    if (!found) return notFound(c);
    const number = Number(c.req.query("n"));
    if (!Number.isInteger(number) || number < 1) return notFound(c);
    const db = c.get("db");
    const promptId = found.item.row.id;
    const [v] = await db
      .select({ id: promptVersion.id })
      .from(promptVersion)
      .where(and(eq(promptVersion.promptId, promptId), eq(promptVersion.number, number)));
    if (!v) return notFound(c);
    if (found.item.row.versionCount <= 1) {
      return c.json({ error: "A prompt keeps at least one version" }, 400);
    }
    await db.transaction(async (tx) => {
      if (v.id === found.item.row.versionId) {
        // The live version goes: the newest remaining one becomes live.
        const [next] = await tx
          .select({ id: promptVersion.id })
          .from(promptVersion)
          .where(and(eq(promptVersion.promptId, promptId), ne(promptVersion.id, v.id)))
          .orderBy(desc(promptVersion.number))
          .limit(1);
        await tx
          .update(prompt)
          .set({ currentVersionId: next?.id ?? null })
          .where(eq(prompt.id, promptId));
      }
      await tx.delete(promptVersion).where(eq(promptVersion.id, v.id));
    });
    return c.body(null, 204);
  });
