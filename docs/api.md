# API

JSON over HTTPS on the same origin as the web app (`/api/*`). Session in `__Host-` HttpOnly cookies (see `docs/security.md`); every non-GET request needs our `Origin` and `content-type: application/json`. Errors are `{ "error": "<safe message>" }` (plus `requestId` for 4xx/5xx raised by the error handler). Request and response shapes for projects and prompts live in `packages/core/src/projects.ts`.

| Method | Path                                         | What                                                     | Errors                    |
| ------ | -------------------------------------------- | -------------------------------------------------------- | ------------------------- |
| GET    | `/api/health`                                | liveness                                                 |                           |
| GET    | `/api/auth/session`                          | current user or `null` (renews the access token)         |                           |
| POST   | `/api/auth/sign-in`, `/sign-out`, `/refresh` | session cookies                                          | 400, 401, 429             |
| POST   | `/api/auth/reset`, `/session`, `/password`   | password reset flow                                      | 400, 401, 429             |
| GET    | `/api/me`                                    | signed-in user                                           | 401                       |
| PATCH  | `/api/me`                                    | `{ locale?, theme? }`                                    | 400, 401                  |
| GET    | `/api/projects`                              | own projects, newest first, with prompt counts           | 401                       |
| POST   | `/api/projects`                              | `{ slug, name, description? }` → 201                     | 400, 401, 409 (slug)      |
| GET    | `/api/projects/:handle/:project`             | project with its prompts                                 | 401, 404                  |
| POST   | `/api/projects/:handle/:project/prompts`     | `{ slug, title, body, variables? }` → 201 with version 1 | 400, 401, 404, 409 (slug) |
| GET    | `/api/projects/:handle/:project/prompts/:p`  | prompt with its current version                          | 401, 404                  |

**Authorisation.** Projects and prompts are scoped by the signed-in owner; anything else (other user's handle, missing or foreign project) is 404, indistinguishable from "does not exist". Public projects become readable by others in Phase 4. Each endpoint has an "other user → 404" test in `apps/api/test/projects.test.ts`.

**Variables.** On prompt creation the stored definitions follow the body (`syncDefinitions`): variables used in the body are kept with their given default/description, new ones are added, unused ones are dropped.
