/**
 * Central error handling: clients get a short message and a request id, never a stack trace,
 * SQL or upstream response; details go to the structured log under the same request id.
 */
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { log } from "./log";

/** Cloudflare's ray id when present (it ties our log to the edge log), otherwise a random id. */
export function requestId(c: Context): string {
  return c.req.header("cf-ray") ?? crypto.randomUUID();
}

/** Thrown by handlers for expected failures; `message` is safe to show to the client. */
export class ApiError extends HTTPException {}

export const handleError: ErrorHandler = (err, c) => {
  const id = requestId(c);
  if (err instanceof HTTPException) {
    // Expected, deliberate failure (bad input, too large, ...): its message was written for users.
    if (err.status >= 500) log.error("http_error", { id, status: err.status, path: c.req.path });
    return c.json({ error: err.message || "Request failed", requestId: id }, err.status);
  }
  log.error("unhandled_error", {
    id,
    method: c.req.method,
    path: c.req.path,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  return c.json({ error: "Something went wrong", requestId: id }, 500);
};

export const handleNotFound: NotFoundHandler = (c) => c.json({ error: "Not found" }, 404);
