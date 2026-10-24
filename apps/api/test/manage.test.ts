import type { FolderListing, ProjectSummary, PromptDetail, VersionSummary } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

/** Owner with project `p`, folder `f` and prompt `f/letter` with two versions. */
async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/p`;
  const created = await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
  expect(created.status).toBe(201);
  const dir = await request("POST", `${base}/folders`, { slug: "f", name: "F" }, s.cookie);
  expect(dir.status).toBe(201);
  const prompt = { folder: ["f"], slug: "letter", title: "Letter", body: "Dear {{name}}, v1." };
  expect((await request("POST", `${base}/prompts`, prompt, s.cookie)).status).toBe(201);
  const v2 = { body: "Dear {{name}}, v2.", variables: [{ name: "name", default: "Ann" }] };
  expect((await request("POST", `${base}/versions/f/letter`, v2, s.cookie)).status).toBe(201);
  return base;
}

async function list(s: TestSession, archived = false) {
  const res = await request(
    "GET",
    `/api/projects${archived ? "?archived=1" : ""}`,
    undefined,
    s.cookie,
  );
  return (await res.json<{ projects: ProjectSummary[] }>()).projects.map((p) => p.slug);
}

describe("project settings (#51)", () => {
  it("renames, changes the description and moves to a new slug; the old URL is gone", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const res = await request(
        "PATCH",
        base,
        { name: "Letters", slug: "letters", description: "Mail" },
        s.cookie,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        slug: "letters",
        name: "Letters",
        description: "Mail",
        archived: false,
        promptCount: 1,
      });
      expect((await request("GET", base, undefined, s.cookie)).status).toBe(404);
      const moved = await request(
        "GET",
        `/api/projects/${s.handle}/letters/path/f/letter`,
        undefined,
        s.cookie,
      );
      expect(moved.status).toBe(200);
      expect((await moved.json<PromptDetail>()).version.number).toBe(2);
    });
  });

  it("rejects a taken slug, invalid input and an empty change", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await request("POST", "/api/projects", { slug: "other", name: "Other" }, s.cookie);
      expect((await request("PATCH", base, { slug: "other" }, s.cookie)).status).toBe(409);
      for (const body of [{}, { slug: "Bad Slug" }, { name: "" }, { owner: "someone" }]) {
        const res = await request("PATCH", base, body, s.cookie);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    });
  });

  it("archive hides the project from the list but keeps it reachable; unarchive undoes it", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const res = await request("PATCH", base, { archived: true }, s.cookie);
      expect((await res.json<ProjectSummary>()).archived).toBe(true);
      expect(await list(s)).toEqual([]);
      expect(await list(s, true)).toEqual(["p"]);
      const root = await request("GET", base, undefined, s.cookie);
      expect((await root.json<FolderListing>()).project.archived).toBe(true);

      await request("PATCH", base, { archived: false }, s.cookie);
      expect(await list(s)).toEqual(["p"]);
      expect(await list(s, true)).toEqual([]);
    });
  });

  it("delete is final and cascades to folders, prompts and versions", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      expect((await request("DELETE", base, undefined, s.cookie)).status).toBe(204);
      expect((await request("GET", base, undefined, s.cookie)).status).toBe(404);
      expect(await list(s)).toEqual([]);
      expect(await list(s, true)).toEqual([]);
      // The slug is free again: a new project with it starts empty.
      await request("POST", "/api/projects", { slug: "p", name: "P again" }, s.cookie);
      const fresh = await (await request("GET", base, undefined, s.cookie)).json<FolderListing>();
      expect(fresh.folders).toEqual([]);
      expect(fresh.prompts).toEqual([]);
      const old = await request("GET", `${base}/path/f/letter`, undefined, s.cookie);
      expect(old.status).toBe(404);
    });
  });
});

describe("duplicate a prompt (#51)", () => {
  it("copies the current version as v1 into the same folder; the original is untouched", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const res = await request(
        "POST",
        `${base}/copy/f/letter`,
        { slug: "letter-copy", title: "Letter (copy)" },
        s.cookie,
      );
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        slug: "letter-copy",
        title: "Letter (copy)",
        folder: ["f"],
        versionCount: 1,
        version: {
          number: 1,
          body: "Dear {{name}}, v2.",
          variables: [{ name: "name", default: "Ann" }],
          message: "Copied from letter v2",
        },
      });
      const history = await request("GET", `${base}/versions/f/letter`, undefined, s.cookie);
      const { versions } = await history.json<{ versions: VersionSummary[] }>();
      expect(versions.map((v) => v.number)).toEqual([2, 1]);
      const dir = await request("GET", `${base}/path/f`, undefined, s.cookie);
      const slugs = (await dir.json<FolderListing>()).prompts.map((p) => p.slug);
      expect(slugs.sort()).toEqual(["letter", "letter-copy"]);
    });
  });

  it("refuses a slug in use (prompt or folder), a folder as source and bad input", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const copy = (path: string, body: unknown) =>
        request("POST", `${base}/copy/${path}`, body, s.cookie);
      const sub = { parent: ["f"], slug: "sub", name: "Sub" };
      await request("POST", `${base}/folders`, sub, s.cookie);
      expect((await copy("f/letter", { slug: "letter", title: "X" })).status).toBe(409);
      expect((await copy("f/letter", { slug: "sub", title: "X" })).status).toBe(409);
      expect((await copy("f", { slug: "f-copy", title: "X" })).status).toBe(404);
      expect((await copy("f/missing", { slug: "x", title: "X" })).status).toBe(404);
      expect((await copy("f/letter", { slug: "ok", title: "" })).status).toBe(400);
      expect((await copy("f/letter", { slug: "ok", title: "X", body: "y" })).status).toBe(400);
    });
  });
});
