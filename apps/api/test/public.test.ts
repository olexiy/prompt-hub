import { exports } from "cloudflare:workers";
import type { FolderListing, PromptDetail } from "@prompt-hub/core";
import { describe, expect, it } from "vitest";
import { request, withNewUser, type TestSession } from "./helpers";

/** A request with no session at all, as a signed-out visitor sends it. */
const anonymous = (path: string) =>
  exports.default.fetch(`http://localhost${path}`, {
    headers: { "cf-connecting-ip": `198.51.100.${String(Math.floor(Math.random() * 250))}` },
  });

/** Project `p` (folder `f`, prompt `f/letter` with two versions and meta) plus a private `q`. */
async function seed(s: TestSession) {
  const base = `/api/projects/${s.handle}/p`;
  await request("POST", "/api/projects", { slug: "p", name: "P" }, s.cookie);
  await request("POST", "/api/projects", { slug: "q", name: "Q" }, s.cookie);
  await request("POST", `${base}/folders`, { slug: "f", name: "F" }, s.cookie);
  const prompt = { folder: ["f"], slug: "letter", title: "Letter", body: "Old {{name}} text." };
  await request("POST", `${base}/prompts`, prompt, s.cookie);
  await request("POST", `${base}/versions/f/letter`, { body: "Dear {{name}}." }, s.cookie);
  const meta = { meta: { description: "A letter", note: "secret note", Model: "M" } };
  await request("PATCH", `${base}/path/f/letter`, meta, s.cookie);
  return base;
}

describe("public projects (#53)", () => {
  it("a private project is 404 for visitors and other users on every public endpoint", async () => {
    await withNewUser(async (s) => {
      await seed(s);
      const pub = `/api/public/projects/${s.handle}/p`;
      for (const path of [pub, `${pub}/path/f`, `${pub}/path/f/letter`]) {
        expect((await anonymous(path)).status, path).toBe(404);
      }
      await withNewUser(async (other) => {
        expect((await request("GET", `${pub}/path/f/letter`, undefined, other.cookie)).status).toBe(
          404,
        );
      });
    });
  });

  it("a public project shows its live versions to anyone, redacted", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      const made = await request("PATCH", base, { visibility: "PUBLIC" }, s.cookie);
      expect(made.status).toBe(200);
      const pub = `/api/public/projects/${s.handle}/p`;

      const root = await anonymous(pub);
      expect(root.status).toBe(200);
      const listing = await root.json<FolderListing>();
      expect(listing).toMatchObject({ access: "public", owner: s.handle, path: [] });
      expect(listing.folders.map((f) => f.slug)).toEqual(["f"]);

      const res = await anonymous(`${pub}/path/f/letter`);
      expect(res.status).toBe(200);
      const prompt = await res.json<PromptDetail>();
      expect(prompt).toMatchObject({ access: "public", title: "Letter", versionCount: 0 });
      expect(prompt.version).toMatchObject({ number: 0, message: "", body: "Dear {{name}}." });
      expect(prompt.meta).toEqual({ description: "A letter", Model: "M" });
      expect(JSON.stringify(prompt)).not.toContain("Old ");
      expect(JSON.stringify(prompt)).not.toContain("secret note");

      // The owner's own API is unchanged and still complete.
      const own = await request("GET", `${base}/path/f/letter`, undefined, s.cookie);
      const full = await own.json<PromptDetail>();
      expect(full).toMatchObject({
        access: "owner",
        versionCount: 2,
        meta: { note: "secret note" },
      });
    });
  });

  it("public never opens history, writes, other projects or archived projects", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      await request("PATCH", base, { visibility: "PUBLIC" }, s.cookie);
      const pub = `/api/public/projects/${s.handle}`;
      // The private sibling and unknown paths stay hidden.
      expect((await anonymous(`${pub}/q`)).status).toBe(404);
      expect((await anonymous(`${pub}/p/path/f/missing`)).status).toBe(404);
      expect((await anonymous(`${pub}/p/versions/f/letter`)).status).toBe(404);
      expect((await anonymous(`${pub}/p/path/f/letter?n=1`)).status).toBe(200);

      await withNewUser(async (other) => {
        // Owner endpoints stay closed to other users even for a public project.
        for (const [method, path, body] of [
          ["GET", `${base}/versions/f/letter`, undefined],
          ["GET", `${base}/path/f/letter`, undefined],
          ["PATCH", `${base}/path/f/letter`, { title: "Hijacked" }],
          ["PATCH", base, { visibility: "PRIVATE" }],
          ["POST", `${base}/copy/f/letter`, { slug: "x", title: "X" }],
          ["DELETE", base, undefined],
        ] as const) {
          const res = await request(method, path, body, other.cookie);
          expect(res.status, `${method} ${path}`).toBe(404);
        }
        // Writes through the public prefix do not exist.
        const write = await request(
          "PATCH",
          `${pub}/p/path/f/letter`,
          { title: "X" },
          other.cookie,
        );
        expect(write.status).toBe(404);
      });

      // Archived public projects are not public any more.
      await request("PATCH", base, { archived: true }, s.cookie);
      expect((await anonymous(`${pub}/p`)).status).toBe(404);
      await request("PATCH", base, { archived: false, visibility: "PRIVATE" }, s.cookie);
      expect((await anonymous(`${pub}/p`)).status).toBe(404);
    });
  });

  it("rejects an unknown visibility", async () => {
    await withNewUser(async (s) => {
      const base = await seed(s);
      expect((await request("PATCH", base, { visibility: "SHARED" }, s.cookie)).status).toBe(400);
    });
  });
});
