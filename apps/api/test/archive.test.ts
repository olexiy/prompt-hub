import { readProjectZip, type FolderListing, type PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/clips`;
  await request(
    "POST",
    "/api/projects",
    { slug: "clips", name: "Clips", description: "D" },
    s.cookie,
  );
  await request("PATCH", base, { tags: ["video"] }, s.cookie);
  await request("POST", `${base}/folders`, { slug: "rain", name: "Дождь" }, s.cookie);
  await request(
    "POST",
    `${base}/prompts`,
    {
      folder: ["rain"],
      slug: "girl",
      title: "Девушка",
      body: "Old {{время}}",
      variables: [{ name: "время", default: "ночь" }],
      tags: ["h3"],
      meta: { note: "n", Model: "H3" },
    },
    s.cookie,
  );
  await request(
    "POST",
    `${base}/versions/rain/girl`,
    { body: "Ждёт {{время}}.", variables: [{ name: "время", default: "ночь" }] },
    s.cookie,
  );
  await request(
    "POST",
    `${base}/prompts`,
    { slug: "brief", title: "Brief", body: "Liebe Oma" },
    s.cookie,
  );
  return base;
}

const exportZip = async (s: TestSession, base: string) => {
  const res = await request("GET", `${base}/export`, undefined, s.cookie);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/zip");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="clips.zip"');
  return new Uint8Array(await res.arrayBuffer());
};

describe("project zip export and import (#57)", () => {
  it("round-trips a project: export, read in the 'browser', import under a new slug", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const read = readProjectZip(await exportZip(s, base), "clips.zip");
      if (!read.ok) throw new Error(read.error);
      expect(read.bundle.prompts).toHaveLength(2);

      const res = await request(
        "POST",
        "/api/projects/import",
        { ...read.bundle, slug: "copy" },
        s.cookie,
      );
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ slug: "copy", prompts: 2 });

      const root = await (
        await request("GET", `/api/projects/${s.handle}/copy`, undefined, s.cookie)
      ).json<FolderListing>();
      expect(root.project).toMatchObject({ name: "Clips", description: "D", tags: ["video"] });
      expect(root.folders).toEqual([{ slug: "rain", name: "Дождь" }]);
      const girl = await (
        await request("GET", `/api/projects/${s.handle}/copy/path/rain/girl`, undefined, s.cookie)
      ).json<PromptDetail>();
      expect(girl).toMatchObject({
        title: "Девушка",
        tags: ["h3"],
        meta: { note: "n", Model: "H3" },
        versionCount: 1,
        version: {
          number: 1,
          body: "Ждёт {{время}}.",
          variables: [{ name: "время", default: "ночь" }],
        },
      });
      // The live version only: the old text is not part of the copy.
      expect(JSON.stringify(read.bundle)).not.toContain("Old ");
      // Importing again under the same slug is a conflict.
      const again = await request(
        "POST",
        "/api/projects/import",
        { ...read.bundle, slug: "copy" },
        s.cookie,
      );
      expect(again.status).toBe(409);
    });
  });

  it("only the owner can export; import needs a session", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await withNewUser(async (other) => {
        expect((await request("GET", `${base}/export`, undefined, other.cookie)).status).toBe(404);
      });
      await request("PATCH", base, { visibility: "PUBLIC" }, s.cookie);
      await withNewUser(async (other) => {
        expect((await request("GET", `${base}/export`, undefined, other.cookie)).status).toBe(404);
      });
      expect((await request("GET", `${base}/export`, undefined)).status).toBe(401);
      const bundle = { slug: "x", name: "X", folders: [], prompts: [] };
      expect((await request("POST", "/api/projects/import", bundle)).status).toBe(401);
    });
  });

  it("refuses inconsistent or hostile bundles and enforces the import size limit", async () => {
    await withNewUser(async (s) => {
      const ok = { slug: "x", name: "X", folders: [], prompts: [] };
      const prompt = { folder: [], slug: "a", title: "A", body: "b" };
      for (const bad of [
        { ...ok, folders: [{ path: ["a", "b"], name: "B" }] },
        { ...ok, prompts: [{ ...prompt, folder: ["missing"] }] },
        { ...ok, prompts: [prompt, prompt] },
        { ...ok, prompts: [{ ...prompt, slug: "../../etc" }] },
        { ...ok, prompts: [{ ...prompt, body: "a\u0000b" }] },
        {
          ...ok,
          prompts: Array.from({ length: 2001 }, (_, i) => ({ ...prompt, slug: `p${String(i)}` })),
        },
        { ...ok, extra: true },
      ]) {
        const res = await request("POST", "/api/projects/import", bad, s.cookie);
        expect(res.status, JSON.stringify(bad).slice(0, 60)).toBe(400);
      }
      // Larger than the usual 256 KB is fine for an import; above 8 MB it is refused.
      const medium = {
        ...ok,
        prompts: Array.from({ length: 5 }, (_, i) => ({
          ...prompt,
          slug: `p${String(i)}`,
          body: "x".repeat(90_000),
        })),
      };
      expect((await request("POST", "/api/projects/import", medium, s.cookie)).status).toBe(201);
      const huge = await request(
        "POST",
        "/api/projects/import",
        "x".repeat(9 * 1024 * 1024),
        s.cookie,
      );
      expect(huge.status).toBe(413);
    });
  });
});
