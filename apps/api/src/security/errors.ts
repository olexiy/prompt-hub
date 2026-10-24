/**
 * Central error handling: clients get a short message and a request id, never a stack trace,
 * SQL or upstream response; details go to the structured log under the same request id.
 */
import { API_ERRORS, errorBody, type ApiErrorCode } from "@prompt-hub/core";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "./log";

/** Cloudflare's ray id when present (it ties our log to the edge log), otherwise a random id. */
export function requestId(c: Context): string {
  return c.req.header("cf-ray") ?? crypto.randomUUID();
}

/** Thrown by handlers for expected failures; the code's message is safe to show to the client. */
export class ApiError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
  ) {
    super(status, { message: API_ERRORS[code] });
  }
}

export const handleError: ErrorHandler = (err, c) => {
  const id = requestId(c);
  if (err instanceof HTTPException) {
    // Expected, deliberate failure (bad input, too large, ...): its message was written for users.
    if (err.status >= 500) log.error("http_error", { id, status: err.status, path: c.req.path });
    const body = err instanceof ApiError ? errorBody(err.code) : errorBody("invalidRequest");
    return c.json({ ...body, requestId: id }, err.status);
  }
  log.error("unhandled_error", {
    id,
    method: c.req.method,
    path: c.req.path,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  return c.json({ ...errorBody("generic"), requestId: id }, 500);
};

export const handleNotFound: NotFoundHandler = (c) => c.json(errorBody("notFound"), 404);
