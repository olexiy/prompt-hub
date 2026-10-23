import { APP_NAME, type HealthResponse } from "@prompt-hub/core";
import { Hono } from "hono";
import type { AppEnv } from "./app-env";
import { requireUser, sameOrigin } from "./auth/middleware";
import { authRoutes } from "./auth/routes";

/**
 * The single Worker: REST API under /api, static web app for everything else
 * (assets are served by the platform; only /api/* reaches this code first).
 * `Env` (bindings from wrangler.jsonc and .dev.vars) is declared in the generated worker-configuration.d.ts.
 */
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", sameOrigin);

app.get("/health", (c) => c.json({ status: "ok", app: APP_NAME } satisfies HealthResponse));

app.route("/auth", authRoutes);

app.get("/me", requireUser, (c) => {
  const { id, handle, displayName, locale, theme } = c.get("user");
  return c.json({ id, handle, displayName, locale, theme });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

export default app;
