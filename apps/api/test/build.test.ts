import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/app-env";
import { BUILD_HEADER, buildCheck } from "../src/security/build";

/** A tiny app behind the middleware with a fixed deployed build id. */
function appWith(build: string | null) {
  const app = new Hono<AppEnv>();
  app.use(
    "*",
    buildCheck(() => Promise.resolve(build)),
  );
  app.get("/x", (c) => c.json({ ok: true }));
  app.post("/x", (c) => c.json({ ok: true }));
  return (method: string, client?: string) =>
    app.request("/x", { method, headers: client ? { [BUILD_HEADER]: client } : {} }, env);
}

describe("stale-client check (#73)", () => {
  it("returns the deployed build id on every response", async () => {
    const res = await appWith("b2")("GET");
    expect(res.status).toBe(200);
    expect(res.headers.get(BUILD_HEADER)).toBe("b2");
  });

  it("lets an old tab read but refuses its writes with 409", async () => {
    const send = appWith("b2");
    expect((await send("GET", "b1")).status).toBe(200);
    const res = await send("POST", "b1");
    expect(res.status).toBe(409);
    expect(res.headers.get(BUILD_HEADER)).toBe("b2");
    expect(await res.json()).toEqual({
      error: "A new version of the app is available. Reload the page.",
      code: "staleClient",
    });
  });

  it("accepts writes from the current build and from clients that send no build id", async () => {
    const send = appWith("b2");
    expect((await send("POST", "b2")).status).toBe(200);
    expect((await send("POST")).status).toBe(200);
  });

  it("checks nothing when the deployed build is unknown", async () => {
    const res = await appWith(null)("POST", "b1");
    expect(res.status).toBe(200);
    expect(res.headers.get(BUILD_HEADER)).toBeNull();
  });
});
