/**
 * Shared domain code used by both the web app and the API: schemas, types and the
 * `{{variable}}` renderer.
 */

export * from "./diff";
export * from "./id";
export * from "./meta";
export * from "./prefs";
export * from "./promptfile";
export * from "./projects";
export * from "./routes";
export * from "./search";
export * from "./variables";
export * from "./slug";
export * from "./tags";

/** Product name shown in the UI and in API responses until the final name is chosen (#7). */
export const APP_NAME = "Prompt Hub";

/** Shape of the API health response, shared so the web app and the API cannot drift apart. */
export interface HealthResponse {
  status: "ok";
  app: typeof APP_NAME;
}
