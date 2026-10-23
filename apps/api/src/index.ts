import { APP_NAME, type HealthResponse } from "@prompt-hub/core";
import { Hono } from "hono";

/**
 * The single Worker: REST API under /api, static web app for everything else
 * (assets are served by the platform; only /api/* reaches this code first).
 * `Env` (bindings from wrangler.jsonc) is declared in the generated worker-configuration.d.ts.
 */
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ status: "ok", app: APP_NAME } satisfies HealthResponse));

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
