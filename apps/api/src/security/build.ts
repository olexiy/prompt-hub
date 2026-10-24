/**
 * Stale-client detection (#73). The web build writes its id to /build.json next to the bundle;
 * the Worker reads that file from its own assets and returns the id as `X-App-Build` on every
 * API response. A tab opened before a deploy sees a different id and asks the user to reload.
 * Writes from such a tab (it sends its own id in `X-App-Build`) are refused with 409, so an old
 * client can never submit a form to an API it no longer matches.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

export const BUILD_HEADER = "X-App-Build";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Where to get the deployed build id; `null` when unknown (no web build next to the Worker). */
export type BuildSource = (env: Env) => Promise<string | null>;

let cached: Promise<string | null> | undefined;

/**
 * The id from the deployed assets. Worker and assets are deployed as one version, and a deploy
 * starts fresh isolates, so the value is read once per isolate.
 */
export const assetBuild: BuildSource = (env) => {
  cached ??= env.ASSETS.fetch("https://assets.local/build.json")
    .then(async (res) => (res.ok ? ((await res.json<{ build?: unknown }>()).build ?? null) : null))
    .then((build) => (typeof build === "string" && build ? build : null))
    .catch(() => null);
  return cached;
};

/** Sets `X-App-Build` on the response and refuses writes from a client of another build. */
export const buildCheck = (source: BuildSource = assetBuild) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const build = await source(c.env);
    const client = c.req.header(BUILD_HEADER);
    if (build && client && client !== build && !SAFE_METHODS.has(c.req.method)) {
      c.header(BUILD_HEADER, build);
      return c.json({ error: "A new version of the app is available. Reload the page." }, 409);
    }
    await next();
    if (build) c.res.headers.set(BUILD_HEADER, build);
  });
