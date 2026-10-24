import type { FolderListing, ProjectSummary, PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

const newProject = { slug: "comfy-h3", name: "Comfy H3", description: "Video prompts" };
const newPrompt = {
  slug: "bus-stop",
  title: "Bus stop, 9 s",
  body: "Shot of {{subject}} at {{время}}. Größe: {{Größe}}.",
  variables: [
    { name: "время", default: "сумерки" },
    { name: "unused", default: "dropped" },
  ],
};

/** Owner with one project and one prompt. */
async function seed(s: TestSession) {
  const p = await request("POST", "/api/projects", newProject, s.cookie);
  expect(p.status).toBe(201);
  const q = await request(
    "POST",
    `/api/projects/${s.handle}/comfy-h3/prompts`,
    newPrompt,
    s.cookie,
  );
  expect(q.status).toBe(201);
}

describe("projects and prompts", () => {
  it("create and read back a project and a prompt with version 1", async () => {
    await withNewUser(async (s) => {
      await seed(s);

      const list = await (
        await request("GET", "/api/projects", undefined, s.cookie)
      ).json<{
        projects: ProjectSummary[];
      }>();
      expect(list.projects).toHaveLength(1);
      expect(list.projects[0]).toMatchObject({
        slug: "comfy-h3",
        name: "Comfy H3",
        visibility: "PRIVATE",
        promptCount: 1,
      });

      const detail = await (
        await request("GET", `/api/projects/${s.handle}/comfy-h3`, undefined, s.cookie)
      ).json<FolderListing>();
      expect(detail.owner).toBe(s.handle);
      expect(detail.prompts.map((p) => p.slug)).toEqual(["bus-stop"]);

      const prompt = await (
        await request(
          "GET",
          `/api/projects/${s.handle}/comfy-h3/path/bus-stop`,
          undefined,
          s.cookie,
        )
      ).json<PromptDetail>();
      expect(prompt.title).toBe("Bus stop, 9 s");
      expect(prompt.version.number).toBe(1);
      expect(prompt.version.body).toBe(newPrompt.body);
      // Definitions follow the body: used ones kept (with defaults), new ones added, unused dropped.
      expect(prompt.version.variables).toEqual([
        { name: "subject" },
        { name: "время", default: "сумерки" },
        { name: "Größe" },
      ]);
    });
  });

  it("duplicate slugs answer 409", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      expect((await request("POST", "/api/projects", newProject, s.cookie)).status).toBe(409);
      const dup = await request(
        "POST",
        `/api/projects/${s.handle}/comfy-h3/prompts`,
        newPrompt,
        s.cookie,
      );
      expect(dup.status).toBe(409);
      expect(await dup.json()).toEqual({
        error: "This folder already has a prompt or folder with this URL slug",
      });
    });
  });

  it.each([
    [{ ...newProject, slug: "Bad Slug" }],
    [{ ...newProject, slug: "settings" }],
    [{ ...newProject, name: "" }],
    [{ ...newProject, name: "x".repeat(101) }],
    [{ ...newProject, ownerId: "00000000-0000-0000-0000-000000000000" }],
  ])("rejects invalid project %#", async (body) => {
    await withNewUser(async (s) => {
      const res = await request("POST", "/api/projects", body, s.cookie);
      expect(res.status).toBe(400);
      expect((await res.json<{ error: string }>()).error).toBe(
        "Check the project name and URL slug",
      );
    });
  });

  it("rejects invalid prompts", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      const url = `/api/projects/${s.handle}/comfy-h3/prompts`;
      for (const body of [
        { ...newPrompt, slug: "x_y" },
        { ...newPrompt, title: "" },
        { ...newPrompt, body: "x".repeat(100_001) },
        { ...newPrompt, variables: [{ name: "a b" }] },
        { ...newPrompt, variables: [{ name: "a" }, { name: "a" }] },
      ]) {
        expect((await request("POST", url, body, s.cookie)).status).toBe(400);
      }
    });
  });
});

describe("authorisation", () => {
  it("another user gets 404 on every endpoint, even with the right handle in the URL", async () => {
    await withNewUser(async (owner) => {
      await seed(owner);
      await withNewUser(async (other) => {
        const base = `/api/projects/${owner.handle}/comfy-h3`;
        for (const [method, path, body] of [
          ["GET", base, undefined],
          ["GET", `${base}/path/bus-stop`, undefined],
          ["GET", `${base}/folders`, undefined],
          ["POST", `${base}/folders`, { slug: "x", name: "X" }],
          ["PATCH", `${base}/path/bus-stop`, { to: [] }],
          ["DELETE", `${base}/path/bus-stop`, undefined],
          ["POST", `${base}/prompts`, { ...newPrompt, slug: "intruder" }],
          ["PATCH", base, { name: "Taken over" }],
          ["PATCH", base, { archived: true }],
          ["POST", `${base}/copy/bus-stop`, { slug: "stolen", title: "Stolen" }],
          ["DELETE", base, undefined],
        ] as const) {
          const res = await request(method, path, body, other.cookie);
          expect(res.status, `${method} ${path}`).toBe(404);
        }
        // Their own list does not contain the owner's project.
        const list = await (
          await request("GET", "/api/projects", undefined, other.cookie)
        ).json<{
          projects: ProjectSummary[];
        }>();
        expect(list.projects).toEqual([]);
        // Their own namespace with the same slug is simply empty.
        expect(
          (await request("GET", `/api/projects/${other.handle}/comfy-h3`, undefined, other.cookie))
            .status,
        ).toBe(404);
      });
      // The owner's data is untouched.
      const detail = await (
        await request("GET", `/api/projects/${owner.handle}/comfy-h3`, undefined, owner.cookie)
      ).json<FolderListing>();
      expect(detail.prompts.map((p) => p.slug)).toEqual(["bus-stop"]);
    });
  });

  it("401 without a session on every endpoint", async () => {
    for (const [method, path] of [
      ["GET", "/api/projects"],
      ["POST", "/api/projects"],
      ["GET", "/api/projects/a/b"],
      ["POST", "/api/projects/a/b/prompts"],
      ["GET", "/api/projects/a/b/path/c"],
      ["POST", "/api/projects/a/b/folders"],
      ["DELETE", "/api/projects/a/b/path/c"],
      ["PATCH", "/api/projects/a/b"],
      ["DELETE", "/api/projects/a/b"],
      ["POST", "/api/projects/a/b/copy/c"],
    ] as const) {
      const res = await request(method, path, method === "POST" ? newProject : undefined);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});

describe("folders", () => {
  it("nest folders, create and move prompts, resolve paths, rename and delete", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      const base = `/api/projects/${s.handle}/comfy-h3`;
      const post = (path: string, body: unknown) =>
        request("POST", `${base}${path}`, body, s.cookie);
      const get = (path: string) => request("GET", `${base}${path}`, undefined, s.cookie);

      expect((await post("/folders", { slug: "shots", name: "Shots" })).status).toBe(201);
      expect(
        (await post("/folders", { parent: ["shots"], slug: "night", name: "Night шоты" })).status,
      ).toBe(201);
      const inNight = await post("/prompts", {
        folder: ["shots", "night"],
        slug: "tram",
        title: "Tram",
        body: "Tram at {{время}}",
      });
      expect(inNight.status).toBe(201);
      expect((await inNight.json<PromptDetail>()).folder).toEqual(["shots", "night"]);

      // Paths resolve to folders and prompts.
      const shots = await (await get("/path/shots")).json<FolderListing>();
      expect(shots).toMatchObject({ kind: "folder", name: "Shots", path: ["shots"] });
      expect(shots.folders).toEqual([{ slug: "night", name: "Night шоты" }]);
      const tram = await (await get("/path/shots/night/tram")).json<PromptDetail>();
      expect(tram).toMatchObject({ kind: "prompt", title: "Tram", folder: ["shots", "night"] });
      expect((await get("/path/shots/nope")).status).toBe(404);
      expect((await get("/path/Shots")).status).toBe(404);

      // Root lists only what is directly inside.
      const root = await (await get("")).json<FolderListing>();
      expect(root.folders.map((f) => f.slug)).toEqual(["shots"]);
      expect(root.prompts.map((p) => p.slug)).toEqual(["bus-stop"]);

      // All folders as paths, for move pickers.
      const all = await (await get("/folders")).json<{ folders: { path: string[] }[] }>();
      expect(all.folders.map((f) => f.path.join("/"))).toEqual(["shots", "shots/night"]);

      // A folder and a prompt cannot share a slug in the same parent.
      expect((await post("/folders", { slug: "bus-stop", name: "Clash" })).status).toBe(409);
      expect((await post("/prompts", { slug: "shots", title: "Clash", body: "" })).status).toBe(
        409,
      );

      // Move keeps the prompt and its version.
      const moved = await request("PATCH", `${base}/path/bus-stop`, { to: ["shots"] }, s.cookie);
      expect(moved.status).toBe(200);
      expect((await get("/path/shots/bus-stop")).status).toBe(200);
      expect((await get("/path/bus-stop")).status).toBe(404);

      // Rename a folder (the slug, and so the URL, stays).
      const renamed = await request("PATCH", `${base}/path/shots`, { name: "Кадры" }, s.cookie);
      expect((await renamed.json<FolderListing>()).name).toBe("Кадры");

      // Deleting a folder takes everything inside with it.
      expect((await request("DELETE", `${base}/path/shots`, undefined, s.cookie)).status).toBe(204);
      expect((await get("/path/shots/night/tram")).status).toBe(404);
      const after = await (await get("")).json<FolderListing>();
      expect(after.project.promptCount).toBe(0);
    });
  });

  it("rejects bad folder input", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      const url = `/api/projects/${s.handle}/comfy-h3/folders`;
      expect((await request("POST", url, { slug: "a b", name: "x" }, s.cookie)).status).toBe(400);
      expect((await request("POST", url, { slug: "a", name: "" }, s.cookie)).status).toBe(400);
      expect(
        (await request("POST", url, { parent: ["missing"], slug: "a", name: "A" }, s.cookie))
          .status,
      ).toBe(404);
      const deep = Array.from({ length: 7 }, (_, i) => `f${String(i)}`);
      for (let i = 0; i < deep.length; i++) {
        const res = await request(
          "POST",
          url,
          { parent: deep.slice(0, i), slug: deep[i], name: "F" },
          s.cookie,
        );
        expect(res.status, `depth ${String(i + 1)}`).toBe(i + 1 < 8 ? 201 : 400);
      }
      const tooDeep = await request("POST", url, { parent: deep, slug: "f7", name: "F" }, s.cookie);
      expect(tooDeep.status).toBe(400);
    });
  });
});
