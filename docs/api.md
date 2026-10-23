# API

JSON over HTTPS on the same origin as the web app (`/api/*`). Session in `__Host-` HttpOnly cookies (see `docs/security.md`); every non-GET request needs our `Origin` and `content-type: application/json`. Errors are `{ "error": "<safe message>" }` (plus `requestId` for 4xx/5xx raised by the error handler). Request and response shapes for projects and prompts live in `packages/core/src/projects.ts`.

| Method | Path                                           | What                                                                                          | Errors                    |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| GET    | `/api/health`                                  | liveness                                                                                      |                           |
| GET    | `/api/auth/session`                            | current user or `null` (renews the access token)                                              |                           |
| POST   | `/api/auth/sign-in`, `/sign-out`, `/refresh`   | session cookies                                                                               | 400, 401, 429             |
| POST   | `/api/auth/reset`, `/session`, `/password`     | password reset flow                                                                           | 400, 401, 429             |
| GET    | `/api/me`                                      | signed-in user                                                                                | 401                       |
| PATCH  | `/api/me`                                      | `{ locale?, theme? }`                                                                         | 400, 401                  |
| GET    | `/api/projects`                                | own projects, newest first, with prompt counts                                                | 401                       |
| POST   | `/api/projects`                                | `{ slug, name, description? }` → 201                                                          | 400, 401, 409 (slug)      |
| GET    | `/api/projects/:handle/:project`               | project root: folders and prompts directly inside                                             | 401, 404                  |
| GET    | `/api/projects/:handle/:project/path/*`        | a folder listing or a prompt with its current version                                         | 401, 404                  |
| GET    | `/api/projects/:handle/:project/folders`       | all folders as paths (for move pickers)                                                       | 401, 404                  |
| POST   | `/api/projects/:handle/:project/folders`       | `{ parent?, slug, name }` → 201                                                               | 400, 401, 404, 409 (slug) |
| POST   | `/api/projects/:handle/:project/prompts`       | `{ folder?, slug, title, body, variables? }` → 201, v1                                        | 400, 401, 404, 409 (slug) |
| PATCH  | `/api/projects/:handle/:project/path/*`        | folder `{ name }`; prompt `{ to }`, `{ title }` or `{ slug }`                                 | 400, 401, 404, 409        |
| DELETE | `/api/projects/:handle/:project/path/*`        | delete a folder (with contents) or a prompt → 204                                             | 401, 404                  |
| GET    | `/api/projects/:handle/:project/versions/*`    | history, newest first; `?n=3` reads one version                                               | 401, 404                  |
| POST   | `/api/projects/:handle/:project/versions/*`    | `{ body, variables? }` (new version, only on "Save as new version") or `{ restore: n }` → 201 | 400, 401, 404, 409        |
| PUT    | `/api/projects/:handle/:project/versions/*`    | `{ body, variables? }` → 200: plain save, edits the current version in place                  | 400, 401, 404             |
| DELETE | `/api/projects/:handle/:project/versions/*?n=` | delete one version (never the last) → 204                                                     | 400, 401, 404             |

**Authorisation.** Projects and prompts are scoped by the signed-in owner; anything else (other user's handle, missing or foreign project) is 404, indistinguishable from "does not exist". Public projects become readable by others in Phase 4. Each endpoint has an "other user → 404" test in `apps/api/test/projects.test.ts`.

**Paths.** Items are addressed like the web URLs (`/path/shots/night/tram`); folders nest up to 7 levels plus the prompt. A folder and a prompt never share a slug in the same parent, so a path is unambiguous; a clash answers 409. Renaming a folder keeps its slug (and URL); deletes are final and cascade.

**Versions.** Every save or restore creates a new immutable version and makes it live; numbers come from a per-prompt counter and are never reused after deletes. Deleting the live version makes the newest remaining one live.

**Variables.** On prompt creation the stored definitions follow the body (`syncDefinitions`): variables used in the body are kept with their given default/description, new ones are added, unused ones are dropped.
