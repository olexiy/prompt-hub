/**
 * /api/search — full-text search over the signed-in user's own, non-archived projects (#55).
 *
 * Uses the generated `tsvector` columns (simple configuration, GIN indexes from #20): prompt
 * titles, the live version's text, project name/description, plus exact tag names. Every query
 * word must match as a word prefix. Only live versions are searched, never history.
 */
import {
  SEARCH_PAGE_SIZE,
  searchTagNames,
  toTsQuery,
  type PromptHit,
  type SearchResults,
} from "@prompt-hub/core";
import { and, desc, eq, isNull, project, sql } from "@prompt-hub/db";
import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { requireUser } from "../auth/middleware";
import { summaryColumns, toSummary } from "./routes";

const MAX_PAGE = 50;
const PROJECT_HITS = 5;

// A type alias, not an interface: `db.execute` wants a Record-compatible row type.
type PromptRow = {
  project: string;
  project_name: string;
  folder: string[] | null;
  slug: string;
  title: string;
  tags: string[];
  snippet: string;
};

export const searchRoutes = new Hono<AppEnv>().use("*", requireUser).get("/", async (c) => {
  const q = (c.req.query("q") ?? "").slice(0, 200);
  const page = Math.min(
    Math.max(Number.parseInt(c.req.query("page") ?? "1", 10) || 1, 1),
    MAX_PAGE,
  );
  const tsquery = toTsQuery(q);
  const empty: SearchResults = { query: q, page, projects: [], prompts: [], hasMore: false };
  if (!tsquery) return c.json(empty);

  const db = c.get("db");
  const userId = c.get("user").id;
  const tagNames = searchTagNames(q);
  // `in ${tagNames}` expands to a parameter list; tagNames is never empty when tsquery is not.
  const hasTag = (link: "project" | "prompt", id: SQL) =>
    sql`exists (select 1 from ${sql.raw(`"${link}_tag"`)} lt join "tag" t on t."id" = lt."tag_id" where lt.${sql.raw(`"${link}_id"`)} = ${id} and t."name" in ${tagNames})`;

  const projects =
    page === 1
      ? await db
          .select(summaryColumns)
          .from(project)
          .where(
            and(
              eq(project.ownerId, userId),
              isNull(project.archivedAt),
              sql`(${project.search} @@ to_tsquery('simple', ${tsquery}) or ${hasTag("project", sql`"project"."id"`)})`,
            ),
          )
          .orderBy(desc(sql`ts_rank(${project.search}, to_tsquery('simple', ${tsquery}))`))
          .limit(PROJECT_HITS)
      : [];

  // Folder paths come from a recursive walk over the user's folders; the snippet is plain text
  // (empty highlight markers; ts_headline also drops tag-like `<…>` parts), the client
  // highlights matches itself.
  const rows = await db.execute<PromptRow>(sql`
    with recursive fp(id, path) as (
      select f."id", array[f."slug"]::text[] from "folder" f
        join "project" pr on pr."id" = f."project_id"
        where pr."owner_id" = ${userId} and f."parent_id" is null
      union all
      select f."id", fp.path || f."slug" from "folder" f join fp on f."parent_id" = fp.id
    ), query as (select to_tsquery('simple', ${tsquery}) as q)
    select pr."slug" as project, pr."name" as project_name, to_jsonb(fp.path) as folder,
      p."slug", p."title",
      (select coalesce(jsonb_agg(t."name" order by t."name"), '[]'::jsonb)
         from "prompt_tag" pt join "tag" t on t."id" = pt."tag_id" where pt."prompt_id" = p."id") as tags,
      ts_headline('simple', left(v."body", 20000), query.q,
        'StartSel="", StopSel="", MaxWords=30, MinWords=12, MaxFragments=1') as snippet
    from "prompt" p
      join "project" pr on pr."id" = p."project_id"
      join "prompt_version" v on v."id" = p."current_version_id"
      left join fp on fp.id = p."folder_id"
      cross join query
    where pr."owner_id" = ${userId} and pr."archived_at" is null
      and (p."search" @@ query.q or v."search" @@ query.q or ${hasTag("prompt", sql`p."id"`)})
    order by
      ts_rank(p."search", query.q) * 4 + ts_rank(v."search", query.q)
        + case when ${hasTag("prompt", sql`p."id"`)} then 2 else 0 end desc,
      p."updated_at" desc
    limit ${SEARCH_PAGE_SIZE + 1} offset ${(page - 1) * SEARCH_PAGE_SIZE}
  `);

  const prompts: PromptHit[] = rows.slice(0, SEARCH_PAGE_SIZE).map((r) => ({
    project: r.project,
    projectName: r.project_name,
    folder: r.folder ?? [],
    slug: r.slug,
    title: r.title,
    tags: r.tags,
    snippet: r.snippet,
  }));
  const results: SearchResults = {
    query: q,
    page,
    projects: projects.map(toSummary),
    prompts,
    hasMore: rows.length > SEARCH_PAGE_SIZE,
  };
  return c.json(results);
});

type SQL = ReturnType<typeof sql>;
