/**
 * Projects as zip archives (features 37, 38; #57).
 *
 * Layout (optionally inside one top directory, as "compress folder" tools make it):
 *   project.json             {"format": "prompt-hub/1", "slug", "name", "description", "tags"}
 *   <folder>/_folder.json    {"name"}: display name of a folder (optional)
 *   <folder>/<prompt>.md     one prompt, written by `serializePromptFile` (live version only)
 * Plain zipped folders of `.md`/`.txt` files import too: names and slugs then come from the
 * directory and file names.
 *
 * The browser reads archives (`readProjectZip`) with hard limits and turns them into a
 * `ProjectBundle`; the API only ever receives that JSON and validates it with
 * `projectBundleSchema`. No archive is parsed on the server.
 */
import { strToU8, unzipSync, Zip, ZipDeflate } from "fflate";
import { z } from "zod";
import { metaSchema, type Meta } from "./meta";
import {
  decodePromptFile,
  MAX_PROMPT_FILE_BYTES,
  parsePromptFile,
  serializePromptFile,
} from "./promptfile";
import { MAX_ITEM_DEPTH } from "./routes";
import { isValidSlug, suggestSlug } from "./slug";
import { tagsSchema } from "./tags";
import { MAX_PROMPT_BODY, variableDefsSchema, type VariableDef } from "./variables";

export const ZIP_FORMAT = "prompt-hub/1";
export const ZIP_LIMITS = {
  /** Entries in the archive, directories included. */
  entries: 2000,
  /** Uncompressed bytes of all files together. */
  totalBytes: 20 * 1024 * 1024,
  folders: 500,
  prompts: 2000,
} as const;

export interface BundleFolder {
  /** Slug path, parents first; [] is never a folder (that is the project root). */
  path: string[];
  name: string;
}

export interface BundlePrompt {
  folder: string[];
  slug: string;
  title: string;
  body: string;
  variables: VariableDef[];
  tags: string[];
  meta: Meta;
}

export interface ProjectBundle {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  folders: BundleFolder[];
  prompts: BundlePrompt[];
}

const slug = z.string().refine(isValidSlug, "Invalid slug");
const path = z.array(slug).max(MAX_ITEM_DEPTH - 1);

/**
 * What `POST /api/projects/import` accepts: every folder's parent exists and comes first, every
 * prompt's folder exists, and no slug repeats inside one parent (folders and prompts together).
 */
export const projectBundleSchema = z
  .strictObject({
    slug,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).default(""),
    tags: tagsSchema.default([]),
    folders: z
      .array(z.strictObject({ path: path.min(1), name: z.string().trim().min(1).max(100) }))
      .max(ZIP_LIMITS.folders),
    prompts: z
      .array(
        z.strictObject({
          folder: path,
          slug,
          title: z.string().trim().min(1).max(200),
          body: z.string().max(MAX_PROMPT_BODY),
          variables: variableDefsSchema.default([]),
          tags: tagsSchema.default([]),
          meta: metaSchema.default({}),
        }),
      )
      .max(ZIP_LIMITS.prompts),
  })
  .superRefine((b, ctx) => {
    const key = (p: readonly string[]) => p.join("/");
    const known = new Set<string>([""]);
    const names = new Set<string>();
    for (const f of b.folders) {
      if (!known.has(key(f.path.slice(0, -1)))) {
        ctx.addIssue({ code: "custom", message: "Folder before its parent" });
        return;
      }
      const k = key(f.path);
      if (names.has(k)) {
        ctx.addIssue({ code: "custom", message: "Duplicate slug" });
        return;
      }
      known.add(k);
      names.add(k);
    }
    for (const p of b.prompts) {
      const k = key([...p.folder, p.slug]);
      if (!known.has(key(p.folder)) || names.has(k)) {
        ctx.addIssue({ code: "custom", message: "Unknown folder or duplicate slug" });
        return;
      }
      names.add(k);
    }
  });

// ---------------------------------------------------------------------------------------------
// Export

/** Entry name → bytes for a bundle, inside a top directory named after the project slug. */
function bundleFiles(bundle: ProjectBundle): [string, Uint8Array][] {
  const json = (v: unknown) => strToU8(`${JSON.stringify(v, null, 2)}\n`);
  const root = `${bundle.slug}/`;
  const files: [string, Uint8Array][] = [
    [
      `${root}project.json`,
      json({
        format: ZIP_FORMAT,
        slug: bundle.slug,
        name: bundle.name,
        description: bundle.description,
        tags: bundle.tags,
      }),
    ],
  ];
  for (const f of bundle.folders) {
    files.push([`${root}${f.path.join("/")}/_folder.json`, json({ name: f.name })]);
  }
  for (const p of bundle.prompts) {
    const dir = p.folder.length > 0 ? `${p.folder.join("/")}/` : "";
    const { title, body, tags, variables, meta } = p;
    files.push([
      `${root}${dir}${p.slug}.md`,
      strToU8(serializePromptFile({ title, body, tags, variables, meta })),
    ]);
  }
  return files;
}

/** The bundle as a zip, produced file by file into a stream (the Worker sends it as is). */
export function projectZipStream(bundle: ProjectBundle): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      for (const [name, data] of bundleFiles(bundle)) {
        const entry = new ZipDeflate(name, { level: 6 });
        zip.add(entry);
        entry.push(data, true);
      }
      zip.end();
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Import

export type ZipError =
  | "notZip"
  | "unsafePath"
  | "tooManyEntries"
  | "tooLarge"
  | "fileTooLarge"
  | "tooDeep"
  | "badProjectJson"
  | "badFile"
  | "empty"
  | "invalid";

export type ZipReadResult =
  | { ok: true; bundle: ProjectBundle; skipped: string[] }
  | { ok: false; error: ZipError; detail?: string | undefined };

class ZipReadError extends Error {
  constructor(
    readonly error: ZipError,
    readonly detail?: string,
  ) {
    super(error);
  }
}

/**
 * True for a relative path with plain segments: no leading slash, drive letter, backslash, `.`
 * or `..` segment, NUL, or empty segment (except a trailing slash for directories).
 */
export function isSafeEntryName(name: string): boolean {
  if (name === "" || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return false;
  if (name.includes("\\") || name.includes("\u0000")) return false;
  const segments = name.replace(/\/$/, "").split("/");
  return segments.every((s) => s !== "" && s !== "." && s !== "..");
}

/** System clutter that zip tools add and nobody wants imported. */
const isJunk = (name: string) => name.split("/").some((s) => s === "__MACOSX" || s.startsWith("."));

const stem = (file: string) => file.replace(/\.[^.]+$/, "");

/** Slug from a display name, `fallback` when nothing usable is left (e.g. CJK-only names). */
const slugFrom = (name: string, fallback: string) => {
  const s = suggestSlug(name);
  return isValidSlug(s) ? s : fallback;
};

/** `base`, then `base-2`, `base-3`, … until it is not in `taken` (which it then joins). */
function unique(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base.slice(0, 60)}-${String(i)}`;
  taken.add(candidate);
  return candidate;
}

function readJson(bytes: Uint8Array, name: string): Record<string, unknown> {
  const text = decodePromptFile(bytes);
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ZipReadError(name.endsWith("project.json") ? "badProjectJson" : "badFile", name);
}

/**
 * Reads a project archive in the browser. Entry names and declared sizes are checked before
 * anything is inflated; one unsafe path rejects the whole archive. `zipName` names the project
 * when there is no `project.json` and no single top directory.
 */
export function readProjectZip(bytes: Uint8Array, zipName: string): ZipReadResult {
  let entries: Record<string, Uint8Array>;
  try {
    let count = 0;
    let total = 0;
    entries = unzipSync(bytes, {
      filter(file) {
        count += 1;
        if (count > ZIP_LIMITS.entries) throw new ZipReadError("tooManyEntries");
        if (!isSafeEntryName(file.name)) throw new ZipReadError("unsafePath", file.name);
        if (file.name.endsWith("/") || isJunk(file.name)) return false;
        if (file.originalSize > MAX_PROMPT_FILE_BYTES) {
          throw new ZipReadError("fileTooLarge", file.name);
        }
        total += file.originalSize;
        if (total > ZIP_LIMITS.totalBytes) throw new ZipReadError("tooLarge");
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ZipReadError) return { ok: false, error: err.error, detail: err.detail };
    return { ok: false, error: "notZip" };
  }

  try {
    return buildBundle(entries, zipName);
  } catch (err) {
    if (err instanceof ZipReadError) return { ok: false, error: err.error, detail: err.detail };
    throw err;
  }
}

function buildBundle(entries: Record<string, Uint8Array>, zipName: string): ZipReadResult {
  // Declared sizes can lie; the inflated data is checked again.
  for (const [name, data] of Object.entries(entries)) {
    if (data.length > MAX_PROMPT_FILE_BYTES) throw new ZipReadError("fileTooLarge", name);
  }
  let names = Object.keys(entries);
  if (names.length === 0) throw new ZipReadError("empty");

  // One shared top directory is a wrapper, not a folder of the project.
  const tops = new Set(names.map((n) => (n.includes("/") ? n.split("/")[0] : "")));
  let wrapper = "";
  const [onlyTop] = [...tops];
  if (tops.size === 1 && onlyTop) {
    wrapper = onlyTop;
    names = names.map((n) => n.slice(wrapper.length + 1));
  }
  const data = (rel: string) => entries[wrapper ? `${wrapper}/${rel}` : rel] ?? new Uint8Array();

  const info = names.includes("project.json") ? readJson(data("project.json"), "project.json") : {};
  if (names.includes("project.json") && info.format !== ZIP_FORMAT) {
    throw new ZipReadError("badProjectJson", "project.json");
  }
  const text = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const projectName = text(info.name, wrapper || stem(zipName)).slice(0, 100) || "Imported";

  // Folder slugs per directory path (display path → slug path), created on demand.
  const folderSlugs = new Map<string, string[]>([["", []]]);
  const takenIn = new Map<string, Set<string>>();
  const taken = (slugPath: string[]) => {
    const k = slugPath.join("/");
    let set = takenIn.get(k);
    if (!set) {
      set = new Set();
      takenIn.set(k, set);
    }
    return set;
  };
  const folders: BundleFolder[] = [];
  const folderNames = new Map<string, string>();
  for (const n of names) {
    if (n.endsWith("/_folder.json")) {
      const dir = n.slice(0, -"/_folder.json".length);
      const name = readJson(data(n), n).name;
      if (typeof name === "string" && name.trim()) folderNames.set(dir, name.trim().slice(0, 100));
    }
  }
  const ensureFolder = (dirs: string[]): string[] => {
    if (dirs.length > MAX_ITEM_DEPTH - 1) throw new ZipReadError("tooDeep", dirs.join("/"));
    const k = dirs.join("/");
    const known = folderSlugs.get(k);
    if (known) return known;
    const parent = ensureFolder(dirs.slice(0, -1));
    const dirName = dirs.at(-1) ?? "";
    const slugPath = [
      ...parent,
      unique(slugFrom(dirName, `folder-${String(folders.length + 1)}`), taken(parent)),
    ];
    folderSlugs.set(k, slugPath);
    folders.push({ path: slugPath, name: folderNames.get(k) ?? dirName.slice(0, 100) });
    return slugPath;
  };

  const prompts: BundlePrompt[] = [];
  const skipped: string[] = [];
  for (const n of [...names].sort()) {
    const file = n.split("/").at(-1) ?? n;
    if (n === "project.json" || file === "_folder.json") continue;
    if (!/\.(md|markdown|txt)$/i.test(file)) {
      skipped.push(n);
      continue;
    }
    const content = decodePromptFile(data(n));
    const parsed = content === null ? null : parsePromptFile(file, content);
    if (!parsed?.ok) throw new ZipReadError("badFile", n);
    const folder = ensureFolder(n.split("/").slice(0, -1));
    const { title, body, tags, variables, meta } = parsed.file;
    prompts.push({
      folder,
      slug: unique(slugFrom(stem(file), `prompt-${String(prompts.length + 1)}`), taken(folder)),
      title: title.slice(0, 200) || stem(file),
      body,
      variables,
      tags,
      meta,
    });
  }
  if (prompts.length === 0) throw new ZipReadError("empty");

  const bundle = {
    slug:
      typeof info.slug === "string" && isValidSlug(info.slug)
        ? info.slug
        : slugFrom(projectName, "imported"),
    name: projectName,
    description: text(info.description, "").slice(0, 1000),
    tags: Array.isArray(info.tags)
      ? info.tags.filter((t): t is string => typeof t === "string")
      : [],
    folders,
    prompts,
  };
  const checked = projectBundleSchema.safeParse(bundle);
  if (!checked.success) {
    throw new ZipReadError("invalid", checked.error.issues[0]?.message ?? "invalid");
  }
  return { ok: true, bundle: checked.data, skipped };
}
