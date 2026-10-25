import type { PromptDetail, VersionDetail, VersionSummary } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

/** Owner with project `p` and prompt `shot` (v1) in folder `f`. */
async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/p`;
  expect((await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie)).status).toBe(
    201,
  );
  await request("POST", `${base}/folders`, { slug: "f", name: "F" }, s.cookie);
  const created = await request(
    "POST",
    `${base}/prompts`,
    { folder: ["f"], slug: "shot", title: "Shot", body: "v1 {{a}}" },
    s.cookie,
  );
  expect(created.status).toBe(201);
  return {
    versions: `${base}/versions/f/shot`,
    item: `${base}/path/f/shot`,
    base,
  };
}

describe("versions", () => {
  it("create, list, read, restore and delete versions", async () => {
    await withNewUser(async (s) => {
      const u = await seed(s);
      const save = (body: unknown) => request("POST", u.versions, body, s.cookie);

      const v2 = await save({
        body: "v2 {{a}} {{тема}}",
        variables: [{ name: "тема", default: "отпуск" }],
      });
      expect(v2.status).toBe(201);
      const after2 = await v2.json<PromptDetail>();
      expect(after2.version).toMatchObject({ number: 2, message: "" });
      expect(after2.versionCount).toBe(2);
      expect(after2.version.variables).toEqual([
        { name: "a" },
        { name: "тема", default: "отпуск" },
      ]);
      await save({ body: "v3" });

      const list = await (
        await request("GET", u.versions, undefined, s.cookie)
      ).json<{
        versions: VersionSummary[];
      }>();
      expect(list.versions.map((v) => [v.number, v.current])).toEqual([
        [3, true],
        [2, false],
        [1, false],
      ]);

      const old = await (
        await request("GET", `${u.versions}?n=1`, undefined, s.cookie)
      ).json<VersionDetail>();
      expect(old).toMatchObject({ number: 1, body: "v1 {{a}}" });

      // Restore copies an old version as the newest; history stays.
      const restored = await (await save({ restore: 1 })).json<PromptDetail>();
      expect(restored.version).toMatchObject({
        number: 4,
        body: "v1 {{a}}",
        message: "Restored v1",
      });
      expect((await save({ restore: 99 })).status).toBe(404);

      // Delete an old version; then the live one: the newest remaining becomes live.
      expect((await request("DELETE", `${u.versions}?n=2`, undefined, s.cookie)).status).toBe(204);
      expect((await request("DELETE", `${u.versions}?n=4`, undefined, s.cookie)).status).toBe(204);
      const live = await (await request("GET", u.item, undefined, s.cookie)).json<PromptDetail>();
      expect(live.version.number).toBe(3);
      expect(live.versionCount).toBe(2);
      // Numbers are not reused after deletes.
      const next = await (await save({ body: "v5" })).json<PromptDetail>();
      expect(next.version.number).toBe(5);

      // The last version cannot be deleted.
      await request("DELETE", `${u.versions}?n=1`, undefined, s.cookie);
      await request("DELETE", `${u.versions}?n=3`, undefined, s.cookie);
      const last = await request("DELETE", `${u.versions}?n=5`, undefined, s.cookie);
      expect(last.status).toBe(400);
    });
  });

  it("a plain save edits the current version in place", async () => {
    await withNewUser(async (s) => {
      const u = await seed(s);
      const edit = (body: unknown) => request("PUT", u.versions, body, s.cookie);

      const res = await edit({
        body: "v1 edited {{a}} {{b}}",
        variables: [{ name: "b", default: "B" }, { name: "gone" }],
      });
      expect(res.status).toBe(200);
      const edited = await res.json<PromptDetail>();
      expect(edited.versionCount).toBe(1);
      expect(edited.version).toMatchObject({ number: 1, body: "v1 edited {{a}} {{b}}" });
      // Definitions follow the text: unknown ones are dropped, new ones added.
      expect(edited.version.variables).toEqual([{ name: "a" }, { name: "b", default: "B" }]);

      // After a new version, a save edits that one and leaves the old one alone.
      await request("POST", u.versions, { body: "v2" }, s.cookie);
      const again = await (await edit({ body: "v2 edited" })).json<PromptDetail>();
      expect(again.version).toMatchObject({ number: 2, body: "v2 edited" });
      expect(again.versionCount).toBe(2);
      const v1 = await (
        await request("GET", `${u.versions}?n=1`, undefined, s.cookie)
      ).json<VersionDetail>();
      expect(v1.body).toBe("v1 edited {{a}} {{b}}");

      for (const body of [
        {},
        { body: "x".repeat(100_001) },
        { body: "x", message: "m" },
        { restore: 1 },
      ]) {
        expect((await edit(body)).status).toBe(400);
      }
      expect((await request("PUT", `${u.base}/versions/f`, { body: "x" }, s.cookie)).status).toBe(
        404,
      );
    });
  });

  it("rename a prompt's title and slug", async () => {
    await withNewUser(async (s) => {
      const u = await seed(s);
      const retitled = await request("PATCH", u.item, { title: "Новый заголовок" }, s.cookie);
      expect((await retitled.json<PromptDetail>()).title).toBe("Новый заголовок");
      const moved = await request("PATCH", u.item, { slug: "shot-2" }, s.cookie);
      expect(moved.status).toBe(200);
      expect((await request("GET", `${u.base}/path/f/shot-2`, undefined, s.cookie)).status).toBe(
        200,
      );
      expect(
        (await request("PATCH", `${u.base}/path/f/shot-2`, { slug: "Bad" }, s.cookie)).status,
      ).toBe(400);
      // Two changes at once are rejected.
      expect(
        (await request("PATCH", `${u.base}/path/f/shot-2`, { title: "x", slug: "y" }, s.cookie))
          .status,
      ).toBe(400);
    });
  });

  it("rejects invalid input and folders", async () => {
    await withNewUser(async (s) => {
      const u = await seed(s);
      for (const body of [
        {},
        { body: "x".repeat(100_001) },
        // User messages are gone (only restores get an automatic label).
        { body: "x", message: "m" },
        { restore: 0 },
        { body: "x", restore: 1 },
      ]) {
        expect((await request("POST", u.versions, body, s.cookie)).status).toBe(400);
      }
      // A folder has no versions.
      expect((await request("GET", `${u.base}/versions/f`, undefined, s.cookie)).status).toBe(404);
    });
  });

  it("another user gets 404 on every version endpoint", async () => {
    await withNewUser(async (owner) => {
      const u = await seed(owner);
      await withNewUser(async (other) => {
        for (const [method, url, body] of [
          ["GET", u.versions, undefined],
          ["GET", `${u.versions}?n=1`, undefined],
          ["POST", u.versions, { body: "hijack" }],
          ["POST", u.versions, { restore: 1 }],
          ["PUT", u.versions, { body: "hijack" }],
          ["DELETE", `${u.versions}?n=1`, undefined],
          ["PATCH", u.item, { title: "hijack" }],
        ] as const) {
          expect((await request(method, url, body, other.cookie)).status, `${method} ${url}`).toBe(
            404,
          );
        }
      });
      const live = await (
        await request("GET", u.item, undefined, owner.cookie)
      ).json<PromptDetail>();
      expect(live).toMatchObject({ title: "Shot", versionCount: 1 });
      expect(live.version.body).toBe("v1 {{a}}");
    });
  });

  it("two deletes at once never remove the last version (#61)", async () => {
    await withNewUser(async (s) => {
      const u = await seed(s);
      await request("POST", u.versions, { body: "v2" }, s.cookie);
      const results = await Promise.all([
        request("DELETE", `${u.versions}?n=1`, undefined, s.cookie),
        request("DELETE", `${u.versions}?n=2`, undefined, s.cookie),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
      const live = await (await request("GET", u.item, undefined, s.cookie)).json<PromptDetail>();
      expect(live.versionCount).toBe(1);
    });
  });
});
