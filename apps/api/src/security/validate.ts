/**
 * Input validation for every route: request bodies are size-limited and parsed with a Zod schema.
 * Failures become a 400 with a message chosen by the route, never Zod's internal details.
 */
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { z } from "zod";
import { ApiError } from "./errors";

/** JSON bodies are small (prompts are the largest item); files go to R2 by other routes later. */
export const MAX_BODY_BYTES = 256 * 1024;

export const limitBody = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => c.json({ error: "Request body is too large" }, 413),
});

/** Parses the JSON body against `schema`; throws a 400 ApiError with `message` when it does not fit. */
export async function parseJson<S extends z.ZodType>(
  c: Context,
  schema: S,
  message = "Invalid request",
): Promise<z.infer<S>> {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(400, { message });
  return result.data;
}
