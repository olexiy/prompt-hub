import { APP_NAME, type HealthResponse } from "@prompt-hub/core";
import { Hono } from "hono";

/** Bindings configured in wrangler.jsonc. */
export interface Env {
  ASSETS: Fetcher;
}

/**
 * The single Worker: REST API under /api, static web app for everything else
 * (assets are served by the platform; only /api/* reaches this code first).
 */
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ status: "ok", app: APP_NAME } satisfies HealthResponse));

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
