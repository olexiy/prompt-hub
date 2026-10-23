import { exports } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleError } from "../src/security/errors";
import { API_SECURITY_HEADERS } from "../src/security/headers";
import { redact } from "../src/security/log";
import { MAX_BODY_BYTES, parseJson } from "../src/security/validate";

const ORIGIN = "http://localhost";

/** Each call gets its own fake client IP unless one is given, so limits never leak between tests. */
function post(path: string, body: string, headers: Record<string, string> = {}) {
  return exports.default.fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "cf-connecting-ip": `198.51.100.${String(Math.floor(Math.random() * 250))}`,
      ...headers,
    },
    body,
  });
}

describe("security headers on API responses", () => {
  it.each([
    ["success", () => exports.default.fetch(`${ORIGIN}/api/health`)],
    ["404", () => exports.default.fetch(`${ORIGIN}/api/nope`)],
    ["401", () => exports.default.fetch(`${ORIGIN}/api/me`)],
    ["400", () => post("/api/auth/sign-in", "{}")],
  ])("are present on %s", async (_, request) => {
    const res = await request();
    for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
      expect(res.headers.get(name), name).toBe(value);
    }
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

describe("input validation", () => {
  it("an invalid body returns 400 with the route's safe message only", async () => {
    const res = await post("/api/auth/sign-in", JSON.stringify({ email: 42, password: [] }));
    expect(res.status).toBe(400);
    const body: { error: string; requestId: string } = await res.json();
    expect(body.error).toBe("Enter an email and a password");
    expect(Object.keys(body).sort()).toEqual(["error", "requestId"]);
  });

  it("malformed JSON returns the same 400", async () => {
    const res = await post("/api/auth/sign-in", "{not json");
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("Enter an email and a password");
  });

  it("a body over the size limit returns 413", async () => {
    const big = JSON.stringify({ email: "a@example.test", password: "x".repeat(MAX_BODY_BYTES) });
    const res = await post("/api/auth/sign-in", big);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Request body is too large" });
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once the auth limit is used up", async () => {
    const ip = { "cf-connecting-ip": "203.0.113.7" };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await post("/api/auth/reset", JSON.stringify({ email: "bad" }), ip)).status);
    }
    // The limit is 10 per minute (wrangler.jsonc): the first ten reach the handler (400), then 429.
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);

    const limited = await post("/api/auth/reset", JSON.stringify({ email: "bad" }), ip);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toEqual({ error: "Too many requests. Try again in a minute." });
  });

  it("limits each client IP separately", async () => {
    const res = await post("/api/auth/reset", JSON.stringify({ email: "bad" }), {
      "cf-connecting-ip": "203.0.113.8",
    });
    expect(res.status).toBe(400);
  });
});

describe("error handling", () => {
  /** A throwaway app with the production error handler and routes that fail on purpose. */
  const app = new Hono()
    .get("/boom", () => {
      throw new Error("db password=hunter2 failed for user@example.test");
    })
    .post("/parse", async (c) => c.json(await parseJson(c, z.object({ n: z.number() }))))
    .onError(handleError);

  it("hides internals from the client and logs them redacted", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await app.request("/boom", { headers: { "cf-ray": "ray-1" } });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "Something went wrong", requestId: "ray-1" });
    expect(text).not.toMatch(/hunter2|stack|at /);

    const logged = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, string>;
    expect(logged).toMatchObject({ level: "error", event: "unhandled_error", id: "ray-1" });
    expect(logged.message).not.toContain("user@example.test");
    spy.mockRestore();
  });

  it("parseJson falls back to a generic message", async () => {
    const res = await app.request("/parse", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("Invalid request");
  });
});

describe("log redaction", () => {
  it("masks sensitive keys and scrubs emails and JWTs from strings", () => {
    expect(
      redact({
        accessToken: "abc",
        nested: { Cookie: "x", note: "mail a@b.co with eyJhbGciOi.eyJzdWIi.sig" },
        list: ["c@d.io"],
        n: 1,
      }),
    ).toEqual({
      accessToken: "[redacted]",
      nested: { Cookie: "[redacted]", note: "mail [email] with [jwt]" },
      list: ["[email]"],
      n: 1,
    });
  });
});
