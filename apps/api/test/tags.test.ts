import type { FolderListing, ProjectSummary, PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/p`;
  await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
  await request("POST", "/api/projects", { slug: "q", name: "Q" }, s.cookie);
  await request("POST", `${base}/prompts`, { slug: "shot", title: "Shot", body: "x" }, s.cookie);
  return base;
}

const ownTags = async (s: TestSession) =>
  (
    await (
      await request("GET", "/api/tags", undefined, s.cookie)
    ).json<{
      tags: { name: string; projects: number; prompts: number }[];
    }>()
  ).tags;

describe("tags (#54)", () => {
  it("sets project and prompt tags (Unicode, normalised) and filters projects by tag", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const res = await request(
        "PATCH",
        base,
        { tags: ["Video", " MiniMax H3 ", "видео", "video"] },
        s.cookie,
      );
      expect(res.status).toBe(200);
      expect((await res.json<ProjectSummary>()).tags).toEqual(["minimax-h3", "video", "видео"]);

      const p = await request("PATCH", `${base}/path/shot`, { tags: ["Видео", "9s"] }, s.cookie);
      expect((await p.json<PromptDetail>()).tags).toEqual(["9s", "видео"]);
      const listing = await (await request("GET", base, undefined, s.cookie)).json<FolderListing>();
      expect(listing.project.tags).toEqual(["minimax-h3", "video", "видео"]);
      expect(listing.prompts[0]?.tags).toEqual(["9s", "видео"]);

      const all = await request("GET", "/api/projects", undefined, s.cookie);
      const list = (await all.json<{ projects: ProjectSummary[] }>()).projects;
      expect(list.find((x) => x.slug === "q")?.tags).toEqual([]);
      const filtered = await request(
        "GET",
        `/api/projects?tag=${encodeURIComponent("видео")}`,
        undefined,
        s.cookie,
      );
      const slugs = (await filtered.json<{ projects: ProjectSummary[] }>()).projects.map(
        (x) => x.slug,
      );
      expect(slugs).toEqual(["p"]);

      expect(await ownTags(s)).toEqual([
        { name: "9s", projects: 0, prompts: 1 },
        { name: "minimax-h3", projects: 1, prompts: 0 },
        { name: "video", projects: 1, prompts: 0 },
        { name: "видео", projects: 1, prompts: 1 },
      ]);
    });
  });

  it("drops tags nothing uses, copies prompt tags on duplicate, cleans up on delete", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await request("PATCH", base, { tags: ["a", "b"] }, s.cookie);
      await request("PATCH", `${base}/path/shot`, { tags: ["b", "c"] }, s.cookie);
      await request("PATCH", base, { tags: [] }, s.cookie);
      expect((await ownTags(s)).map((t) => t.name)).toEqual(["b", "c"]);

      const copy = await request(
        "POST",
        `${base}/copy/shot`,
        { slug: "shot-2", title: "Shot 2" },
        s.cookie,
      );
      expect((await copy.json<PromptDetail>()).tags).toEqual(["b", "c"]);
      await request("DELETE", `${base}/path/shot`, undefined, s.cookie);
      expect((await ownTags(s)).map((t) => t.name)).toEqual(["b", "c"]);
      await request("DELETE", base, undefined, s.cookie);
      expect(await ownTags(s)).toEqual([]);
    });
  });

  it("rejects invalid tags and keeps tags per owner", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      for (const tags of [
        ["a/b"],
        ["<b>"],
        ["x".repeat(33)],
        Array.from({ length: 21 }, (_, i) => `t${String(i)}`),
        "video",
        [1],
      ]) {
        const res = await request("PATCH", base, { tags }, s.cookie);
        expect(res.status, JSON.stringify(tags).slice(0, 30)).toBe(400);
      }
      await request("PATCH", base, { tags: ["shared"] }, s.cookie);
      await withNewUser(async (other) => {
        expect(await ownTags(other)).toEqual([]);
        await request("POST", "/api/projects", { slug: "p", name: "P" }, other.cookie);
        await request(
          "PATCH",
          `/api/projects/${other.handle}/p`,
          { tags: ["shared"] },
          other.cookie,
        );
        const theirs = await request("GET", "/api/projects?tag=shared", undefined, other.cookie);
        const list = (await theirs.json<{ projects: ProjectSummary[] }>()).projects;
        expect(list).toHaveLength(1);
        // Someone else's project tags cannot be changed.
        expect((await request("PATCH", base, { tags: ["x"] }, other.cookie)).status).toBe(404);
        expect((await request("GET", "/api/tags", undefined)).status).toBe(401);
      });
      expect((await ownTags(s)).map((t) => t.name)).toEqual(["shared"]);
    });
  });

  it("public projects show their tags", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await request("PATCH", base, { tags: ["video"], visibility: "PUBLIC" }, s.cookie);
      await request("PATCH", `${base}/path/shot`, { tags: ["9s"] }, s.cookie);
      const pub = `/api/public/projects/${s.handle}/p`;
      const root = await request("GET", pub, undefined);
      const listing = await root.json<FolderListing>();
      expect(listing.project.tags).toEqual(["video"]);
      expect(listing.prompts[0]?.tags).toEqual(["9s"]);
    });
  });
});
