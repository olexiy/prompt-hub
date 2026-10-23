/**
 * Shared domain code used by both the web app and the API: schemas, types and the
 * `{{variable}}` renderer. Filled by later tasks (#20 schema, #25 renderer).
 */

/** Product name shown in the UI and in API responses until the final name is chosen (#7). */
export const APP_NAME = "Prompt Hub";

/** Shape of the API health response, shared so the web app and the API cannot drift apart. */
export interface HealthResponse {
  status: "ok";
  app: typeof APP_NAME;
}
