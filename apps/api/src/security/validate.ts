/**
 * Input validation for every route: request bodies are size-limited and parsed with a Zod schema.
 * Failures become a 400 with a message chosen by the route, never Zod's internal details.
 */
import { errorBody, type ApiErrorCode } from "@prompt-hub/core";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import type { z } from "zod";
import { ApiError } from "./errors";

/** JSON bodies are small (prompts are the largest item); files go to R2 by other routes later. */
export const MAX_BODY_BYTES = 256 * 1024;

/** A whole project imported from a zip (#57) arrives as one JSON bundle. */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

const tooLarge = (c: Context) => c.json(errorBody("tooLarge"), 413);
const limitDefault = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: tooLarge });
const limitImport = bodyLimit({ maxSize: MAX_IMPORT_BYTES, onError: tooLarge });

export const limitBody = createMiddleware((c, next) =>
  c.req.method === "POST" && c.req.path === "/api/projects/import"
    ? limitImport(c, next)
    : limitDefault(c, next),
);

/**
 * True when a string anywhere in the value holds a NUL character: Postgres `text` and `jsonb`
 * cannot store it and would fail the query (a 500), so it is refused up front (#56).
 */
function hasNul(value: unknown): boolean {
  if (typeof value === "string") return value.includes("\u0000");
  if (Array.isArray(value)) return value.some(hasNul);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k.includes("\u0000") || hasNul(v));
  }
  return false;
}

/** Parses the JSON body against `schema`; throws a 400 ApiError with `code` when it does not fit. */
export async function parseJson<S extends z.ZodType>(
  c: Context,
  schema: S,
  code: ApiErrorCode = "invalidRequest",
): Promise<z.infer<S>> {
  const raw: unknown = await c.req.json().catch(() => undefined);
  if (hasNul(raw)) throw new ApiError(400, code);
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(400, code);
  return result.data;
}
