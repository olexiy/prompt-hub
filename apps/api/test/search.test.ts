import type { SearchResults } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/clips`;
  await request(
    "POST",
    "/api/projects",
    { slug: "clips", name: "Video clips", description: "MiniMax shots" },
    s.cookie,
  );
  await request("POST", `${base}/folders`, { slug: "rain", name: "Rain" }, s.cookie);
  const prompts = [
    {
      folder: ["rain"],
      slug: "girl",
      title: "Девушка на остановке",
      body: "Девушка ждёт автобус под дождём, свет фонарей.",
    },
    { slug: "letter", title: "Brief an Oma", body: "Liebe Oma, die Größe des Pakets ist klein." },
    { slug: "bus", title: "Bus stop", body: "A bus stops in the night rain." },
  ];
  for (const p of prompts) await request("POST", `${base}/prompts`, p, s.cookie);
  return base;
}

const search = async (s: TestSession, q: string, page = 1) => {
  const res = await request(
    "GET",
    `/api/search?q=${encodeURIComponent(q)}&page=${String(page)}`,
    undefined,
    s.cookie,
  );
  expect(res.status).toBe(200);
  return res.json<SearchResults>();
};

describe("search (#55)", () => {
  it("finds prompts by title and live text, in Cyrillic, German and English, by word prefix", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      const ru = await search(s, "дожд");
      expect(ru.prompts.map((p) => p.slug)).toEqual(["girl"]);
      expect(ru.prompts[0]).toMatchObject({
        project: "clips",
        projectName: "Video clips",
        folder: ["rain"],
      });
      expect(ru.prompts[0]?.snippet).toContain("дождём");
      expect(ru.prompts[0]?.snippet).not.toContain("<");

      expect((await search(s, "größe")).prompts.map((p) => p.slug)).toEqual(["letter"]);
      expect((await search(s, "OMA")).prompts.map((p) => p.slug)).toEqual(["letter"]);
      // Upper-case Cyrillic matches a title in sentence case.
      expect((await search(s, "ДЕВУШК")).prompts.map((p) => p.slug)).toEqual(["girl"]);
      // "bus" is a word prefix in English only ("автобус" does not start with it); all words must match.
      expect((await search(s, "bus")).prompts.map((p) => p.slug)).toEqual(["bus"]);
      expect((await search(s, "rain night")).prompts.map((p) => p.slug)).toEqual(["bus"]);
      expect((await search(s, "rain nothing")).prompts).toEqual([]);
      // Projects match by name and description.
      expect((await search(s, "minimax")).projects.map((p) => p.slug)).toEqual(["clips"]);
    });
  });

  it("searches the live version only and finds tags", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await request("POST", `${base}/versions/bus`, { body: "Completely new text." }, s.cookie);
      expect((await search(s, "night")).prompts).toEqual([]);
      expect((await search(s, "completely")).prompts.map((p) => p.slug)).toEqual(["bus"]);
      await request("PATCH", `${base}/path/letter`, { tags: ["familie"] }, s.cookie);
      const tagged = await search(s, "familie");
      expect(tagged.prompts.map((p) => p.slug)).toEqual(["letter"]);
      expect(tagged.prompts[0]?.tags).toEqual(["familie"]);
    });
  });

  it("never returns other users' or archived projects; empty and syntax queries are safe", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await withNewUser(async (other) => {
        const theirs = await search(other, "bus");
        expect(theirs.prompts).toEqual([]);
        expect(theirs.projects).toEqual([]);
      });
      await request("PATCH", base, { visibility: "PUBLIC" }, s.cookie);
      await withNewUser(async (other) => {
        expect((await search(other, "bus")).prompts).toEqual([]);
      });
      await request("PATCH", base, { archived: true }, s.cookie);
      expect((await search(s, "bus")).prompts).toEqual([]);

      for (const q of ["", "   ", "' | & ! :* ( )", "a'); drop table prompt; --"]) {
        const res = await search(s, q);
        expect(res.prompts, q).toEqual([]);
      }
      expect((await request("GET", "/api/search?q=bus", undefined)).status).toBe(401);
    });
  });

  it("pages through many hits", async () => {
    await withNewUser(async (s) => {
      const base = `/api/projects/${s.handle}/many`;
      await request("POST", "/api/projects", { slug: "many", name: "Many" }, s.cookie);
      for (let i = 0; i < 23; i++) {
        await request(
          "POST",
          `${base}/prompts`,
          { slug: `p${String(i)}`, title: `Prompt ${String(i)}`, body: "shared word" },
          s.cookie,
        );
      }
      const first = await search(s, "shared");
      expect(first.prompts).toHaveLength(20);
      expect(first.hasMore).toBe(true);
      const second = await search(s, "shared", 2);
      expect(second.prompts).toHaveLength(3);
      expect(second.hasMore).toBe(false);
      expect(second.projects).toEqual([]);
      const all = new Set([...first.prompts, ...second.prompts].map((p) => p.slug));
      expect(all.size).toBe(23);
    });
  });
});
