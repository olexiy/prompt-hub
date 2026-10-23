/**
 * Structured logs: one JSON object per line, picked up by Workers observability.
 * Values under sensitive keys are replaced before anything is written, so tokens, passwords,
 * cookies and email addresses never reach the logs even if a caller passes them by mistake.
 */

const SENSITIVE_KEY = /token|password|secret|authorization|cookie|apikey|api_key|email|jwt/i;
const EMAIL = /[^\s@"']+@[^\s@"']+\.[^\s@"']+/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]*/g;

export type LogFields = Record<string, unknown>;

/** Deep copy with sensitive keys masked and emails/JWTs scrubbed from strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") return value.replace(JWT, "[jwt]").replace(EMAIL, "[email]");
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

function write(level: "info" | "warn" | "error", event: string, fields: LogFields): void {
  const line = JSON.stringify({ level, event, ...(redact(fields) as LogFields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: LogFields = {}) => {
    write("info", event, fields);
  },
  warn: (event: string, fields: LogFields = {}) => {
    write("warn", event, fields);
  },
  error: (event: string, fields: LogFields = {}) => {
    write("error", event, fields);
  },
};
