/**
 * Request schemas and response shapes of the projects/prompts API, shared by the API (validation)
 * and the web app (forms, typed responses). Limits mirror the database checks.
 */
import { z } from "zod";
import { metaSchema, type Meta } from "./meta";
import { MAX_ITEM_DEPTH } from "./routes";
import { tagsSchema } from "./tags";
import { isValidSlug } from "./slug";
import { MAX_PROMPT_BODY, variableDefsSchema, type VariableDef } from "./variables";

const slug = z.string().refine(isValidSlug, "Invalid slug");

/** Folder path inside a project, root = []; leaves room for the prompt segment in URLs. */
export const folderPathSchema = z.array(slug).max(MAX_ITEM_DEPTH - 1);

export const projectCreateSchema = z.strictObject({
  slug,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(""),
});
export type ProjectCreate = z.input<typeof projectCreateSchema>;

/**
 * Project settings (#51): any of name, URL slug, description, archived. A new slug moves the
 * project; old URLs then answer 404 (no redirects, see decisions.md).
 */
export const projectPatchSchema = z
  .strictObject({
    slug,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000),
    archived: z.boolean(),
    visibility: z.enum(["PRIVATE", "PUBLIC"]),
    tags: tagsSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type ProjectPatch = z.input<typeof projectPatchSchema>;

export const folderCreateSchema = z.strictObject({
  parent: folderPathSchema.default([]),
  slug,
  name: z.string().trim().min(1).max(100),
});
export type FolderCreate = z.input<typeof folderCreateSchema>;

export const promptCreateSchema = z.strictObject({
  folder: folderPathSchema.default([]),
  slug,
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_PROMPT_BODY),
  variables: variableDefsSchema.default([]),
  tags: tagsSchema.default([]),
  meta: metaSchema.default({}),
});
export type PromptCreate = z.input<typeof promptCreateSchema>;

/**
 * PATCH on a path, exactly one change: rename a folder (`name`); move a prompt into another
 * folder (`to`), retitle it (`title`), change its URL slug (`slug`) or replace its meta fields
 * (`meta`, the whole map, #52) or its tags (`tags`, the whole set, #54).
 */
export const itemPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100),
    to: folderPathSchema,
    title: z.string().trim().min(1).max(200),
    slug,
    meta: metaSchema,
    tags: tagsSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length === 1, "Exactly one change");
export type ItemPatch = z.input<typeof itemPatchSchema>;

/** Duplicate a prompt (#51): the copy lands in the same folder, its current version as v1. */
export const promptCopySchema = z.strictObject({
  slug,
  title: z.string().trim().min(1).max(200),
});
export type PromptCopy = z.input<typeof promptCopySchema>;

export type Visibility = "PRIVATE" | "PUBLIC";

/**
 * Who the answer is for (#53): the owner gets everything; a public read gets the live version
 * only (no version number, message, count or history) and meta without `note`.
 */
export type Access = "owner" | "public";

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  /** Archived projects are hidden from the dashboard list but stay reachable by URL. */
  archived: boolean;
  /** Topic tags, sorted (#54). */
  tags: string[];
  promptCount: number;
  updatedAt: string;
}

export interface PromptSummary {
  slug: string;
  title: string;
  /** Topic tags, sorted (#54). */
  tags: string[];
  updatedAt: string;
}

/** The full state of a prompt version: text and variable definitions. */
export const versionContentSchema = z.strictObject({
  body: z.string().max(MAX_PROMPT_BODY),
  variables: variableDefsSchema.default([]),
});
export type VersionContent = z.input<typeof versionContentSchema>;

/**
 * A new version, created only when the user asks for one ("Save as new version"): the edited
 * state, or `restore` an old version as the newest. A plain save edits the current version.
 */
export const versionCreateSchema = z.union([
  versionContentSchema,
  z.strictObject({ restore: z.number().int().positive() }),
]);
export type VersionCreate = z.input<typeof versionCreateSchema>;

export interface VersionSummary {
  number: number;
  message: string;
  createdAt: string;
  current: boolean;
}

export interface VersionDetail extends Omit<VersionSummary, "current"> {
  body: string;
  variables: VariableDef[];
}

export interface FolderSummary {
  slug: string;
  name: string;
}

/** A project root (`path: []`) or a folder, with what is directly inside it. */
export interface FolderListing {
  kind: "folder";
  access: Access;
  project: ProjectSummary;
  owner: string;
  path: string[];
  /** Folder name; the project name at the root. */
  name: string;
  folders: FolderSummary[];
  prompts: PromptSummary[];
}

export interface PromptDetail extends PromptSummary {
  kind: "prompt";
  access: Access;
  /** Folder path of the prompt; [] at the project root. */
  folder: string[];
  /** Number of stored versions (history size). */
  versionCount: number;
  /** Meta fields (#52); order them for display with `orderMeta`. */
  meta: Meta;
  /** The current (live) version. */
  version: VersionDetail;
}

/** What `GET /api/projects/:handle/:project/path/*` answers. */
export type ProjectItem = FolderListing | PromptDetail;
