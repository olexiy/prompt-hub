import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("API routing", () => {
  it("GET /api/health returns ok", async () => {
    const res = await exports.default.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ status: "ok", app: "Prompt Hub" });
  });

  it("unknown /api routes return a JSON 404, not the SPA", async () => {
    const res = await exports.default.fetch("http://localhost/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
