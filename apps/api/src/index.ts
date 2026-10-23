import { APP_NAME, LOCALES, THEMES, type HealthResponse } from "@prompt-hub/core";
import { appUser, eq } from "@prompt-hub/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "./app-env";
import { requireUser, sameOrigin } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { projectRoutes } from "./projects/routes";
import { handleError, handleNotFound } from "./security/errors";
import { securityHeaders } from "./security/headers";
import { limitWrites } from "./security/rate-limit";
import { limitBody, parseJson } from "./security/validate";

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
app.route("/projects", projectRoutes);

app.get("/me", requireUser, (c) => {
  const { id, handle, displayName, locale, theme } = c.get("user");
  return c.json({ id, handle, displayName, locale, theme });
});

/** Preferences the user may change themselves; anything else in the body is rejected. */
const mePatch = z
  .strictObject({ locale: z.enum(LOCALES), theme: z.enum(THEMES) })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

app.patch("/me", requireUser, async (c) => {
  const changes = await parseJson(c, mePatch, "Unknown language or theme");
  // Scoped by the signed-in user's id only: there is no way to address another user here.
  const [row] = await c
    .get("db")
    .update(appUser)
    .set(changes)
    .where(eq(appUser.id, c.get("user").id))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  const { id, handle, displayName, locale, theme } = row;
  return c.json({ id, handle, displayName, locale, theme });
});

app.notFound(handleNotFound);
app.onError(handleError);

export default app;
