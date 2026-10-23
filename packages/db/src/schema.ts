/**
 * Database schema v0 (#20), see docs/data-model.md.
 *
 * Conventions: UUIDv7 ids generated in the app; `owner_id` / `project_id` scope every row to a
 * tenant; deletes cascade down the tree (final deletes, feature 102); slugs are re-checked in the
 * database with the same whitelist as packages/core (defence in depth).
 */
import { uuidv7 } from "@prompt-hub/core";
import { sql, type SQL } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Same rule as `isValidSlug` in packages/core (reserved words are checked in the app). */
const slugCheck = (name: string, column: SQL) =>
  check(name, sql`${column} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${column}) <= 64`);

/** One row per person; `id` equals the Supabase Auth user id. */
export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey(),
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull().default(""),
    locale: text("locale").notNull().default("en"),
    theme: text("theme").notNull().default("system"),
    plan: text("plan").notNull().default("FREE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    slugCheck("app_user_handle_check", sql`${t.handle}`),
    check("app_user_locale_check", sql`${t.locale} in ('en', 'ru', 'de')`),
    check("app_user_theme_check", sql`${t.theme} in ('system', 'light', 'dark')`),
    check("app_user_plan_check", sql`${t.plan} in ('FREE', 'PRO')`),
    check("app_user_display_name_length", sql`length(${t.displayName}) <= 100`),
  ],
);

export const project = pgTable(
  "project",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    visibility: text("visibility").notNull().default("PRIVATE"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${project.name} || ' ' || ${project.description})`,
    ),
  },
  (t) => [
    unique("project_owner_slug_key").on(t.ownerId, t.slug),
    slugCheck("project_slug_check", sql`${t.slug}`),
    check("project_visibility_check", sql`${t.visibility} in ('PRIVATE', 'PUBLIC')`),
    check("project_name_length", sql`length(${t.name}) between 1 and 100`),
    check("project_description_length", sql`length(${t.description}) <= 1000`),
    index("project_search_idx").using("gin", t.search),
  ],
);

/** Optional folders inside a project; `parent_id` allows nesting. */
export const folder = pgTable(
  "folder",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folder.id, {
      onDelete: "cascade",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("folder_parent_slug_key").on(t.projectId, t.parentId, t.slug).nullsNotDistinct(),
    slugCheck("folder_slug_check", sql`${t.slug}`),
    check("folder_name_length", sql`length(${t.name}) between 1 and 100`),
  ],
);

export const prompt = pgTable(
  "prompt",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folder.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull().default("TEXT"),
    /** The live version; null only between creating the prompt and its first version. */
    currentVersionId: uuid("current_version_id"),
    /** Free key–value meta fields (feature 27). */
    meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${prompt.title})`,
    ),
  },
  (t) => [
    unique("prompt_folder_slug_key").on(t.projectId, t.folderId, t.slug).nullsNotDistinct(),
    slugCheck("prompt_slug_check", sql`${t.slug}`),
    check("prompt_type_check", sql`${t.type} in ('TEXT', 'CHAT', 'MEDIA')`),
    check("prompt_title_length", sql`length(${t.title}) between 1 and 200`),
    foreignKey({
      name: "prompt_current_version_fk",
      columns: [t.currentVersionId],
      foreignColumns: [promptVersion.id],
    }).onDelete("set null"),
    index("prompt_search_idx").using("gin", t.search),
    index("prompt_folder_idx").on(t.folderId),
  ],
);

/** One variable of a version: `{{name}}` with optional type, default and description. */
export interface VariableDef {
  name: string;
  type?: "text" | "select" | "number" | "boolean" | "multiline";
  default?: string;
  description?: string;
  options?: string[];
}

/** Immutable snapshots of a prompt; deleting one removes the row (feature 73). */
export const promptVersion = pgTable(
  "prompt_version",
  {
    id: id(),
    promptId: uuid("prompt_id")
      .notNull()
      .references((): AnyPgColumn => prompt.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    body: text("body").notNull(),
    /** Named sections (feature 9, v1); null while the prompt is a single text. */
    sections: jsonb("sections").$type<Record<string, string>>(),
    variables: jsonb("variables").$type<VariableDef[]>().notNull().default([]),
    message: text("message").notNull().default(""),
    createdBy: uuid("created_by").references(() => appUser.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${promptVersion.body})`,
    ),
  },
  (t) => [
    unique("prompt_version_number_key").on(t.promptId, t.number),
    check("prompt_version_number_positive", sql`${t.number} > 0`),
    check("prompt_version_body_length", sql`length(${t.body}) <= 100000`),
    check("prompt_version_message_length", sql`length(${t.message}) <= 500`),
    index("prompt_version_search_idx").using("gin", t.search),
  ],
);

/** Tags belong to their owner and can be put on projects and prompts (features 45, 74). */
export const tag = pgTable(
  "tag",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [
    unique("tag_owner_name_key").on(t.ownerId, t.name),
    slugCheck("tag_name_check", sql`${t.name}`),
  ],
);

export const projectTag = pgTable(
  "project_tag",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.tagId] }),
    index("project_tag_tag_idx").on(t.tagId),
  ],
);

export const promptTag = pgTable(
  "prompt_tag",
  {
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompt.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promptId, t.tagId] }), index("prompt_tag_tag_idx").on(t.tagId)],
);

/** Single-use invites (feature 103, Phase 2); only a hash of the code is stored. */
export const invite = pgTable("invite", {
  id: id(),
  codeHash: text("code_hash").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  email: text("email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedBy: uuid("used_by").references(() => appUser.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Limits per plan (feature 76); null means unlimited. Enforced from v3. */
export const planLimit = pgTable(
  "plan_limit",
  {
    plan: text("plan").primaryKey(),
    maxProjects: integer("max_projects"),
    maxPrompts: integer("max_prompts"),
  },
  (t) => [check("plan_limit_plan_check", sql`${t.plan} in ('FREE', 'PRO')`)],
);
