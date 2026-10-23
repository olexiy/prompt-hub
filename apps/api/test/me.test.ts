import { describe, expect, inject, it } from "vitest";
import { cookiesOf, request, withNewUser } from "./helpers";

async function signIn(): Promise<string> {
  const res = await request("POST", "/api/auth/sign-in", inject("testUser"));
  expect(res.status).toBe(200);
  return cookiesOf(res);
}

interface Me {
  handle: string;
  locale: string;
  theme: string;
}

describe("PATCH /api/me", () => {
  it("saves language and theme and returns them from GET /api/me", async () => {
    await withNewUser(async ({ cookie }) => {
      const res = await request("PATCH", "/api/me", { locale: "de", theme: "dark" }, cookie);
      expect(res.status).toBe(200);
      expect(await res.json<Me>()).toMatchObject({ locale: "de", theme: "dark" });

      const me = await (await request("GET", "/api/me", undefined, cookie)).json<Me>();
      expect(me).toMatchObject({ locale: "de", theme: "dark" });

      // Partial update keeps the other field.
      await request("PATCH", "/api/me", { locale: "ru" }, cookie);
      expect(await (await request("GET", "/api/me", undefined, cookie)).json<Me>()).toMatchObject({
        locale: "ru",
        theme: "dark",
      });
    });
  });

  it.each([
    [{ locale: "fr" }],
    [{ theme: "auto" }],
    [{}],
    [{ handle: "someone-else" }],
    [{ locale: "en", plan: "PRO" }],
  ])("rejects %j with 400", async (body) => {
    const cookie = await signIn();
    const res = await request("PATCH", "/api/me", body, cookie);
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("Unknown language or theme");
  });

  it("401 without a session", async () => {
    expect((await request("PATCH", "/api/me", { locale: "de" })).status).toBe(401);
  });
});

describe("first request of a new user", () => {
  it("parallel first requests create one app_user without errors", async () => {
    await withNewUser(
      async ({ cookie }) => {
        const results = await Promise.all(
          Array.from({ length: 5 }, () => request("GET", "/api/me", undefined, cookie)),
        );
        expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
        const handles = await Promise.all(results.map((r) => r.json<Me>().then((m) => m.handle)));
        expect(new Set(handles).size).toBe(1);
      },
      { loadHandle: false },
    );
  });
});
