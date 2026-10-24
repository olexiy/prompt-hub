/**
 * Project zip export and import (#57), owner only.
 *
 * Export streams the zip from the Worker (`projectZipStream`, live versions only). Import takes
 * the JSON bundle the browser built from an archive (`readProjectZip`), never the archive itself,
 * validates it with `projectBundleSchema` and creates the whole project in one transaction with
 * batched inserts.
 */
import {
  projectBundleSchema,
  projectZipStream,
  syncDefinitions,
  uuidv7,
  type ProjectBundle,
} from "@prompt-hub/core";
import {
  asc,
  eq,
  folder,
  inArray,
  project,
  projectTag,
  prompt,
  promptTag,
  promptVersion,
  sql,
  tag,
  type Db,
} from "@prompt-hub/db";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { requireUser } from "../auth/middleware";
import { parseJson } from "../security/validate";
import { cleanDefs, isUniqueViolation, notFound, ownProject } from "./routes";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Postgres takes at most 65535 parameters per statement; rows go in slices well below that. */
const CHUNK = 500;

async function insertChunked<T>(rows: T[], insert: (slice: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/** The project as a bundle: folders parents first, prompts with their live version. */
async function loadBundle(db: Db, projectId: string): Promise<ProjectBundle | null> {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId));
  if (!proj) return null;
  const folders = await db
    .select({ id: folder.id, parentId: folder.parentId, slug: folder.slug, name: folder.name })
    .from(folder)
    .where(eq(folder.projectId, projectId));
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (id: string | null): string[] => {
    const f = id ? byId.get(id) : undefined;
    return f ? [...pathOf(f.parentId), f.slug] : [];
  };
  const tagsOf = (link: "project" | "prompt", id: string) =>
    sql<
      string[]
    >`(select coalesce(jsonb_agg(t."name" order by t."name"), '[]'::jsonb) from ${sql.raw(`"${link}_tag"`)} lt join "tag" t on t."id" = lt."tag_id" where lt.${sql.raw(`"${link}_id"`)} = ${sql.raw(id)})`;
  const prompts = await db
    .select({
      folderId: prompt.folderId,
      slug: prompt.slug,
      title: prompt.title,
      meta: prompt.meta,
      tags: tagsOf("prompt", `"prompt"."id"`),
      body: promptVersion.body,
      variables: promptVersion.variables,
    })
    .from(prompt)
    .innerJoin(promptVersion, eq(promptVersion.id, prompt.currentVersionId))
    .where(eq(prompt.projectId, projectId))
    .orderBy(asc(prompt.slug));
  const [projectTags] = await db
    .select({ tags: tagsOf("project", `"project"."id"`) })
    .from(project)
    .where(eq(project.id, projectId));
  return {
    slug: proj.slug,
    name: proj.name,
    description: proj.description,
    tags: projectTags?.tags ?? [],
    folders: folders
      .map((f) => ({ path: pathOf(f.id), name: f.name }))
      .sort(
        (a, b) => a.path.length - b.path.length || a.path.join("/").localeCompare(b.path.join("/")),
      ),
    prompts: prompts.map((p) => ({
      folder: pathOf(p.folderId),
      slug: p.slug,
      title: p.title,
      body: p.body,
      variables: cleanDefs(p.variables),
      tags: p.tags,
      meta: p.meta,
    })),
  };
}

/** Creates the bundle as a new project of `ownerId`; throws a unique violation on a taken slug. */
async function createFromBundle(tx: Tx, ownerId: string, b: ProjectBundle) {
  const projectId = uuidv7();
  await tx.insert(project).values({
    id: projectId,
    ownerId,
    slug: b.slug,
    name: b.name,
    description: b.description,
  });

  const folderIds = new Map<string, string | null>([["", null]]);
  const folderRows = b.folders.map((f) => {
    const id = uuidv7();
    folderIds.set(f.path.join("/"), id);
    return {
      id,
      projectId,
      parentId: folderIds.get(f.path.slice(0, -1).join("/")) ?? null,
      slug: f.path.at(-1) ?? "",
      name: f.name,
    };
  });
  await insertChunked(folderRows, (rows) => tx.insert(folder).values(rows));

  const promptRows = b.prompts.map((p) => ({
    id: uuidv7(),
    projectId,
    folderId: folderIds.get(p.folder.join("/")) ?? null,
    slug: p.slug,
    title: p.title,
    meta: p.meta,
    lastVersionNumber: 1,
  }));
  await insertChunked(promptRows, (rows) => tx.insert(prompt).values(rows));
  const versionRows = b.prompts.map((p, i) => ({
    promptId: promptRows[i]?.id ?? "",
    number: 1,
    body: p.body,
    variables: cleanDefs(syncDefinitions(p.body, p.variables)),
    message: "Imported",
    createdBy: ownerId,
  }));
  await insertChunked(versionRows, (rows) => tx.insert(promptVersion).values(rows));
  await tx.execute(
    sql`update "prompt" set "current_version_id" = v."id" from "prompt_version" v where v."prompt_id" = "prompt"."id" and "prompt"."project_id" = ${projectId}`,
  );

  const names = [...new Set([...b.tags, ...b.prompts.flatMap((p) => p.tags)])];
  if (names.length > 0) {
    await insertChunked(names, (slice) =>
      tx
        .insert(tag)
        .values(slice.map((name) => ({ ownerId, name })))
        .onConflictDoNothing(),
    );
    const ids = new Map<string, string>();
    for (let i = 0; i < names.length; i += CHUNK) {
      const rows = await tx
        .select({ id: tag.id, name: tag.name })
        .from(tag)
        .where(
          sql`${tag.ownerId} = ${ownerId} and ${inArray(tag.name, names.slice(i, i + CHUNK))}`,
        );
      for (const r of rows) ids.set(r.name, r.id);
    }
    const projectLinks = b.tags.map((n) => ({ projectId, tagId: ids.get(n) ?? "" }));
    if (projectLinks.length > 0) await tx.insert(projectTag).values(projectLinks);
    const promptLinks = b.prompts.flatMap((p, i) =>
      p.tags.map((n) => ({ promptId: promptRows[i]?.id ?? "", tagId: ids.get(n) ?? "" })),
    );
    await insertChunked(promptLinks, (rows) => tx.insert(promptTag).values(rows));
  }
}

export const archiveRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .get("/:handle/:project/export", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const bundle = await loadBundle(c.get("db"), proj.id);
    if (!bundle) return notFound(c);
    return new Response(projectZipStream(bundle), {
      headers: {
        "content-type": "application/zip",
        // Slugs are [a-z0-9-] only, so the file name needs no escaping.
        "content-disposition": `attachment; filename="${bundle.slug}.zip"`,
      },
    });
  })
  .post("/import", async (c) => {
    const bundle = await parseJson(c, projectBundleSchema, "Check the archive contents");
    try {
      await c.get("db").transaction((tx) => createFromBundle(tx, c.get("user").id, bundle));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "You already have a project with this URL slug" }, 409);
      }
      throw err;
    }
    return c.json({ slug: bundle.slug, prompts: bundle.prompts.length }, 201);
  });
