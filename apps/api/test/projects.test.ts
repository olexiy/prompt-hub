import type { ProjectDetail, ProjectSummary, PromptDetail } from "@prompt-hub/core";
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
      ).json<ProjectDetail>();
      expect(detail.owner).toBe(s.handle);
      expect(detail.prompts.map((p) => p.slug)).toEqual(["bus-stop"]);

      const prompt = await (
        await request(
          "GET",
          `/api/projects/${s.handle}/comfy-h3/prompts/bus-stop`,
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
        error: "This project already has a prompt with this URL slug",
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
          ["GET", `${base}/prompts/bus-stop`, undefined],
          ["POST", `${base}/prompts`, { ...newPrompt, slug: "intruder" }],
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
      ).json<ProjectDetail>();
      expect(detail.prompts.map((p) => p.slug)).toEqual(["bus-stop"]);
    });
  });

  it("401 without a session on every endpoint", async () => {
    for (const [method, path] of [
      ["GET", "/api/projects"],
      ["POST", "/api/projects"],
      ["GET", "/api/projects/a/b"],
      ["POST", "/api/projects/a/b/prompts"],
      ["GET", "/api/projects/a/b/prompts/c"],
    ] as const) {
      const res = await request(method, path, method === "POST" ? newProject : undefined);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});
