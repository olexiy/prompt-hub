/**
 * /api/projects/* — projects and prompts of the signed-in user (vertical slice, #40).
 *
 * Authorisation: every query is scoped by the signed-in owner. A `:handle` that is not the
 * signed-in user's, or a project/prompt they do not own, answers 404 — the same as "does not
 * exist", so nothing leaks. Public reads by other users come in Phase 4.
 */
import {
  projectCreateSchema,
  promptCreateSchema,
  syncDefinitions,
  type PromptDetail,
  type ProjectDetail,
  type ProjectSummary,
  type PromptSummary,
  type Visibility,
} from "@prompt-hub/core";
import { and, asc, desc, eq, isNull, project, prompt, promptVersion, sql } from "@prompt-hub/db";
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
  promptCount,
  updatedAt: project.updatedAt,
};

function toSummary(row: {
  slug: string;
  name: string;
  description: string;
  visibility: string;
  promptCount: number;
  updatedAt: Date;
}): ProjectSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility as Visibility,
    promptCount: row.promptCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The signed-in user's project named in the URL, or null (wrong handle, missing, not theirs). */
async function ownProject(c: Context<AppEnv>) {
  const user = c.get("user");
  if (c.req.param("handle") !== user.handle) return null;
  const [row] = await c
    .get("db")
    .select(summaryColumns)
    .from(project)
    .where(and(eq(project.ownerId, user.id), eq(project.slug, c.req.param("project") ?? "")));
  return row ?? null;
}

export const projectRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select(summaryColumns)
      .from(project)
      .where(and(eq(project.ownerId, c.get("user").id), isNull(project.archivedAt)))
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
    const prompts = await c
      .get("db")
      .select({ slug: prompt.slug, title: prompt.title, updatedAt: prompt.updatedAt })
      .from(prompt)
      .where(eq(prompt.projectId, proj.id))
      .orderBy(asc(prompt.title));
    const detail: ProjectDetail = {
      ...toSummary(proj),
      owner: c.get("user").handle,
      prompts: prompts.map((p): PromptSummary => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
    };
    return c.json(detail);
  })
  .post("/:handle/:project/prompts", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const input = await parseJson(c, promptCreateSchema, "Check the title, URL slug and text");
    const variables = cleanDefs(syncDefinitions(input.body, input.variables));
    const userId = c.get("user").id;
    try {
      const created = await c.get("db").transaction(async (tx) => {
        const [p] = await tx
          .insert(prompt)
          .values({ projectId: proj.id, slug: input.slug, title: input.title })
          .returning();
        if (!p) throw new Error("prompt insert returned nothing");
        const [v] = await tx
          .insert(promptVersion)
          .values({ promptId: p.id, number: 1, body: input.body, variables, createdBy: userId })
          .returning();
        if (!v) throw new Error("version insert returned nothing");
        await tx.update(prompt).set({ currentVersionId: v.id }).where(eq(prompt.id, p.id));
        await tx.update(project).set({ updatedAt: new Date() }).where(eq(project.id, proj.id));
        return { p, v };
      });
      const detail: PromptDetail = {
        slug: created.p.slug,
        title: created.p.title,
        updatedAt: created.p.updatedAt.toISOString(),
        version: {
          number: created.v.number,
          body: created.v.body,
          variables,
          createdAt: created.v.createdAt.toISOString(),
        },
      };
      return c.json(detail, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "This project already has a prompt with this URL slug" }, 409);
      }
      throw err;
    }
  })
  .get("/:handle/:project/prompts/:prompt", async (c) => {
    const proj = await ownProject(c);
    if (!proj) return notFound(c);
    const [row] = await c
      .get("db")
      .select({
        slug: prompt.slug,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
        number: promptVersion.number,
        body: promptVersion.body,
        variables: promptVersion.variables,
        createdAt: promptVersion.createdAt,
      })
      .from(prompt)
      .innerJoin(promptVersion, eq(promptVersion.id, prompt.currentVersionId))
      .where(and(eq(prompt.projectId, proj.id), eq(prompt.slug, c.req.param("prompt"))));
    if (!row) return notFound(c);
    const detail: PromptDetail = {
      slug: row.slug,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      version: {
        number: row.number,
        body: row.body,
        variables: cleanDefs(row.variables),
        createdAt: row.createdAt.toISOString(),
      },
    };
    return c.json(detail);
  });
