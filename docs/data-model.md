# Data model (v0, #20)

Source of truth: `packages/db/src/schema.ts` (Drizzle) → SQL migrations in `packages/db/migrations/` (generated, reviewed, committed). Postgres 17 (Supabase).

```mermaid
erDiagram
  app_user ||--o{ project : owns
  app_user ||--o{ tag : owns
  project ||--o{ folder : contains
  folder ||--o{ folder : nests
  project ||--o{ prompt : contains
  folder ||--o{ prompt : groups
  prompt ||--o{ prompt_version : "has history"
  prompt }o--o| prompt_version : "current (live)"
  project }o--o{ tag : project_tag
  prompt }o--o{ tag : prompt_tag
  app_user ||--o{ invite : creates
```

| Table                              | Purpose                              | Notes                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_user`                         | person; `id` = Supabase Auth user id | `handle` unique slug; locale en/ru/de; theme; plan FREE/PRO                                                                                                                        |
| `project`                          | top-level container                  | slug unique per owner; visibility PRIVATE/PUBLIC; `search` tsvector (name + description)                                                                                           |
| `folder`                           | optional, nestable                   | slug unique per parent (NULLS NOT DISTINCT)                                                                                                                                        |
| `prompt`                           | a prompt                             | slug unique per folder; type TEXT/CHAT/MEDIA; `current_version_id` = live version (SET NULL if deleted); `meta` JSONB key–value fields (#52, rules in `packages/core/src/meta.ts`) |
| `prompt_version`                   | immutable snapshot                   | `number` unique per prompt; `body`; `variables` JSONB `[{name,type,default,description,options}]`; `sections` JSONB (v1); `search` tsvector                                        |
| `tag`, `project_tag`, `prompt_tag` | owner's tags on projects and prompts | tag names follow the slug rule                                                                                                                                                     |
| `invite`                           | single-use invites (Phase 2)         | only a hash of the code                                                                                                                                                            |
| `plan_limit`                       | limits per plan                      | seeded: FREE 25 projects / 250 prompts, PRO unlimited; enforced from v3                                                                                                            |

## Rules

- **IDs**: UUIDv7 generated in the app (`uuidv7()` in packages/core) — time-ordered, no dependency on Postgres 18's `uuidv7()`.
- **Tenancy**: every row hangs off `app_user` through `owner_id` or `project_id`; the API scopes every query by owner or `PUBLIC` visibility.
- **Deletes are final** (feature 102) and cascade down: user → projects/tags → folders → prompts → versions → tag links. Deleting the live version clears `current_version_id`.
- **Defence in depth**: slug pattern, enums and length limits are `CHECK` constraints as well as Zod checks in the API. Row Level Security is enabled on every table with no policies, and Supabase's `anon`/`authenticated` roles have no table privileges; the Worker connects as the owner role. The Data API is off.
- **Search**: `to_tsvector('simple', …)` — no language stemming, works the same for EN/RU/DE; GIN indexes.
- `app_user.id` has no foreign key to `auth.users`, so migrations and tests run on plain Postgres; account deletion (feature 55, v1) removes both.

## Working with it

```bash
corepack pnpm db:start
```

```bash
corepack pnpm db:migrate
```

`db:start` runs local Supabase in Docker (Postgres on 54322, Auth, Studio on http://127.0.0.1:54323). `db:migrate` needs `DATABASE_URL` (local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). After changing `schema.ts`: `corepack pnpm db:generate`, review the SQL, commit it. DB tests need `TEST_DATABASE_URL` (same local URL; CI uses a Postgres 17 service) and create a throwaway database per test file.

## Variable syntax

`{{name}}` or `{{ name }}`; a name is 1–64 Unicode letters, digits, `_` or `-`, starting with a letter, digit or `_` (`{{тема}}`, `{{Größe}}`). Anything else between double braces stays plain text. Rendering (`renderPrompt` in `packages/core/src/variables.ts`) fills the value, else the definition's default, else keeps the placeholder and reports the name as unfilled; values are inserted literally, nothing is evaluated. `prompt_version.variables` holds the definitions (`name`, `default`, `description`; typed variables later), validated by `variableDefsSchema`.
