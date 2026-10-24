import { parsePromptFile, type PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser } from "./helpers";

describe("creating a prompt from a file (#56)", () => {
  it("takes tags and meta on create, as a parsed file provides them", async () => {
    await withNewUser(async (s) => {
      await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
      const parsed = parsePromptFile(
        "Größe.md",
        "---\ntags: [Видео, H3]\ndescription: Für Oma\n---\n# Девушка\n\nЖдёт {{время}}.",
      );
      if (!parsed.ok) throw new Error("parse failed");
      const { title, body, tags, meta } = parsed.file;
      const res = await request(
        "POST",
        `/api/projects/${s.handle}/p/prompts`,
        { slug: "girl", title, body, tags, meta },
        s.cookie,
      );
      expect(res.status).toBe(201);
      expect(await res.json<PromptDetail>()).toMatchObject({
        title: "Девушка",
        tags: ["h3", "видео"],
        meta: { description: "Für Oma" },
        version: { body: "Ждёт {{время}}.", variables: [{ name: "время" }] },
      });
    });
  });

  it("refuses NUL characters anywhere in a JSON body instead of failing in the database", async () => {
    await withNewUser(async (s) => {
      await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
      const base = `/api/projects/${s.handle}/p`;
      const nul = "\u0000";
      for (const [method, path, body] of [
        ["POST", `${base}/prompts`, { slug: "a", title: "A", body: `x${nul}y` }],
        ["POST", `${base}/prompts`, { slug: "a", title: `A${nul}`, body: "x" }],
        [
          "POST",
          `${base}/prompts`,
          { slug: "a", title: "A", body: "x", meta: { [`k${nul}`]: "v" } },
        ],
        ["PATCH", base, { description: `d${nul}` }],
      ] as const) {
        const res = await request(method, path, body, s.cookie);
        expect(res.status, `${method} ${path}`).toBe(400);
      }
      await request("POST", `${base}/prompts`, { slug: "ok", title: "Ok", body: "x" }, s.cookie);
      const put = await request("PUT", `${base}/versions/ok`, { body: `bad${nul}` }, s.cookie);
      expect(put.status).toBe(400);
    });
  });

  it("validates tags and meta on create like on edit", async () => {
    await withNewUser(async (s) => {
      await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
      const base = `/api/projects/${s.handle}/p/prompts`;
      for (const extra of [{ tags: ["a/b"] }, { meta: { "a<b": "x" } }, { meta: "x" }]) {
        const res = await request(
          "POST",
          base,
          { slug: "x", title: "X", body: "y", ...extra },
          s.cookie,
        );
        expect(res.status, JSON.stringify(extra)).toBe(400);
      }
    });
  });
});
