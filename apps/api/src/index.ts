import { APP_NAME, type HealthResponse } from "@prompt-hub/core";
import { Hono } from "hono";
import type { AppEnv } from "./app-env";
import { requireUser, sameOrigin } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { handleError, handleNotFound } from "./security/errors";
import { securityHeaders } from "./security/headers";
import { limitWrites } from "./security/rate-limit";
import { limitBody } from "./security/validate";

/**
 * The single Worker: REST API under /api, static web app for everything else
 * (assets are served by the platform; only /api/* reaches this code first).
 * `Env` (bindings from wrangler.jsonc and .dev.vars) is declared in the generated worker-configuration.d.ts.
 */
const app = new Hono<AppEnv>().basePath("/api");

// Order matters: headers wrap everything (also errors), cheap rejections run before any work.
app.use("*", securityHeaders);
app.use("*", sameOrigin);
app.use("*", limitBody);
app.use("*", limitWrites);

app.get("/health", (c) => c.json({ status: "ok", app: APP_NAME } satisfies HealthResponse));

app.route("/auth", authRoutes);

app.get("/me", requireUser, (c) => {
  const { id, handle, displayName, locale, theme } = c.get("user");
  return c.json({ id, handle, displayName, locale, theme });
});

app.notFound(handleNotFound);
app.onError(handleError);

export default app;
