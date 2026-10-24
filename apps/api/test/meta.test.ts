import type { PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser } from "./helpers";

describe("prompt meta fields (#52)", () => {
  it("replaces, returns, keeps text as is and clears the meta map", async () => {
    await withNewUser(async (s) => {
      await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
      const base = `/api/projects/${s.handle}/p`;
      const prompt = { slug: "shot", title: "Shot", body: "x" };
      await request("POST", `${base}/prompts`, prompt, s.cookie);
      const fresh = await request("GET", `${base}/path/shot`, undefined, s.cookie);
      expect((await fresh.json<PromptDetail>()).meta).toEqual({});

      const meta = {
        description: " Static medium shot ",
        note: "",
        Model: "MiniMax H3",
        Workflow: "<script>alert(1)</script>",
      };
      const res = await request("PATCH", `${base}/path/shot`, { meta }, s.cookie);
      expect(res.status).toBe(200);
      const expected = {
        description: "Static medium shot",
        Model: "MiniMax H3",
        Workflow: "<script>alert(1)</script>",
      };
      expect((await res.json<PromptDetail>()).meta).toEqual(expected);
      const read = await request("GET", `${base}/path/shot`, undefined, s.cookie);
      expect((await read.json<PromptDetail>()).meta).toEqual(expected);
      // Meta is not versioned: a new version keeps it.
      await request("POST", `${base}/versions/shot`, { body: "y" }, s.cookie);
      const after = await request("GET", `${base}/path/shot`, undefined, s.cookie);
      expect((await after.json<PromptDetail>()).meta).toEqual(expected);

      const cleared = await request("PATCH", `${base}/path/shot`, { meta: {} }, s.cookie);
      expect((await cleared.json<PromptDetail>()).meta).toEqual({});
    });
  });

  it("rejects bad keys, long values, too many fields, folders and other users", async () => {
    await withNewUser(async (s) => {
      await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
      const base = `/api/projects/${s.handle}/p`;
      await request(
        "POST",
        `${base}/prompts`,
        { slug: "shot", title: "Shot", body: "x" },
        s.cookie,
      );
      await request("POST", `${base}/folders`, { slug: "f", name: "F" }, s.cookie);
      const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${String(i)}`, "v"]));
      for (const meta of [
        { "a<b": "x" },
        { "": "x" },
        { a: "x".repeat(5001) },
        many,
        { a: 1 },
        "text",
      ]) {
        const res = await request("PATCH", `${base}/path/shot`, { meta }, s.cookie);
        expect(res.status, JSON.stringify(meta).slice(0, 40)).toBe(400);
      }
      const both = await request("PATCH", `${base}/path/shot`, { meta: {}, title: "T" }, s.cookie);
      expect(both.status).toBe(400);
      // A folder has no meta: the change does not apply.
      const onFolder = await request("PATCH", `${base}/path/f`, { meta: { a: "b" } }, s.cookie);
      expect(onFolder.status).toBe(400);

      await withNewUser(async (other) => {
        const res = await request("PATCH", `${base}/path/shot`, { meta: { a: "b" } }, other.cookie);
        expect(res.status).toBe(404);
      });
    });
  });
});
