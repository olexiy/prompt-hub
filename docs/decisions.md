# Decisions

Newest first. Format: date — decision. _Why._ Alternatives considered.

## 2026-10-24 — Search: Postgres full text, simple config, word prefixes (#55)

`GET /api/search?q=` searches the signed-in user's own, non-archived projects with the `tsvector` columns and GIN indexes that exist since #20 (`simple` configuration). The query is split into letter/digit words of any script (max 8), each used as a prefix, all required (`bus:* & stop:*`); the tsquery text is built in `packages/core/src/search.ts` from letters and digits only, so no tsquery syntax can be injected. Prompts match on title, the live version's text (never history) or an exact tag name; ranked title × 4 + tag 2 + body, 20 per page. Projects match on name/description or tag, top 5 on page 1. Snippets come from `ts_headline` as plain text and are highlighted in the client. Measured locally on dev data: p50 45 ms, p95 50 ms per request (the budget itself comes with #37). _Why:_ no new service or cost, the indexes already exist, and `simple` treats EN/RU/DE alike; prefixes make search-as-you-type and inflected words workable without per-language stemming. Public projects of other users are not searched yet (v2, feature 46). Alternatives: language-specific configurations (need a language per prompt; mixed-language prompts are common), pg_trgm fuzzy search (typo tolerance; add when needed), an external engine like Meilisearch (a second datastore to secure and sync).

## 2026-10-24 — Tags: Unicode topics, rule in the app, unused tags removed (#54)

Tag names are normalised from what the user types (trim, lowercase, spaces/underscores → hyphens) and must be lowercase letters of any script or digits joined by single hyphens, ≤ 32 chars, ≤ 20 per item (`packages/core/src/tags.ts`). Migration 0003 relaxes the database check from the ASCII slug rule to length + no whitespace: Postgres regex classes and `lower()` depend on the server locale, so the full rule lives in one place, the app. A PATCH replaces the whole tag set of a project or prompt; tags nothing carries any more are deleted, so `GET /api/tags` lists only tags in use. Duplicating a prompt copies its tags. Tags of public projects and their prompts are public. Filtering is client-side in the dashboard and project page (combined with the text filter) plus `GET /api/projects?tag=`; hub-wide search is #55. _Why:_ the acceptance criteria require Unicode (Olexiy tags in RU/DE); keeping unused tags would grow an invisible list. Alternatives: ASCII-only slugs (fails the criteria), a citext/ICU check in the database (locale-dependent, harder to test locally), keeping orphan tags for autocomplete (revisit when there is an autocomplete).

## 2026-10-24 — What a public project exposes (#53)

A project switched to PUBLIC in its settings is readable by anyone with the link, signed in or not, through `GET /api/public/projects/:handle/:project[/path/…]` only. Exposed: project name, description, prompt count, last update, folder tree, prompt titles and slugs, the live version's text and variables, meta fields except `note`. Not exposed: version numbers, messages, counts, other versions, history and diff endpoints, the folder picker, any write. Archived or private projects answer the same 404 as missing ones. The owner always reads through the private API (full view); other signed-in users read through the public one. Public reads are rate-limited per IP (WRITE_LIMITER budget, own counter). Responses and pages send `X-Robots-Tag: noindex, nofollow`. _Why:_ feature 24 promises "latest versions for everyone, nothing else"; a separate route group with its own redaction (`toPublicPrompt`) keeps the owner checks of the private API untouched, so a bug in public code cannot open writes. `note` is the private field by design; custom fields are meant to be shared (model, workflow). Noindex until the product is renamed (#7) and has public profiles (v2). Alternatives: one API with optional auth and per-field checks (larger blast radius), a per-field "private" flag (more UI than the MVP needs), indexing public projects now.

## 2026-10-24 — Prompt meta: one JSONB map, two built-in keys, fixed display order (#52)

Meta stays in `prompt.meta` (JSONB, no migration). `description` and `note` are built-in keys shown translated and first; every other key is a user label (letters of any script, digits, space, `._-`, ≤ 40 chars), shown as typed and sorted alphabetically. At most 20 fields, values ≤ 5000 chars, plain text only. A PATCH replaces the whole map; empty values remove a field. Meta is per prompt, not per version. _Why:_ JSONB does not keep key order, so a fixed order (built-in, then A–Z) is predictable without storing positions; whole-map replace keeps the API to one change type. Alternatives: an ordered array of `{key, value}` (needs a migration and reorder UI; revisit with prompt templates, feature 87), versioned meta (the fields describe the prompt, not a text state).

## 2026-10-24 — Slug changes are not redirected; project delete confirmed by typing its name (#51)

A new project or prompt slug moves the item; old URLs answer 404 like any missing page. The settings form says so before saving ("Old links to this project stop working"). Project delete is final and cascades (feature 15); the web app enables the button only after the exact project name is typed, the API itself needs no extra confirmation field. Duplicating a prompt copies its current version as v1 of a new prompt in the same folder (meta and type too), with the version label "Copied from <slug> v<n>". _Why:_ projects are private until #53 and links are mostly the owner's own bookmarks; a redirect table costs a schema change, lookups on every miss and rules for chains and reused slugs. A 404 never leaks whether a slug existed. Alternatives: GitHub-style redirects from old slugs (revisit with public projects, v2), typing `owner/slug` instead of the name (the name is what the user sees), copying the whole history on duplicate (the copy is meant as a fresh variant).

## 2026-10-24 — Stale tabs: build id from the deployed assets, writes refused (#73)

Each web build writes a random id to `dist/build.json` and into the bundle; the Worker reads the file through its `ASSETS` binding (once per isolate) and sends it as `X-App-Build`. The client shows a reload banner on a mismatch and stops sending writes; the API refuses writes whose `X-App-Build` differs with 409. _Why:_ Worker and assets deploy as one version, so the id can never disagree with what is served, and no build step has to pass the id between the web and API packages; refusing writes on the server also covers a tab whose first request after a deploy is the write itself. Alternatives: polling `/build.json` from the client (no protection for the first write), a git SHA as id (equal for staging and production builds of one commit, and for local rebuilds), a service worker (more moving parts than the problem needs).

## 2026-10-23 — Cloud environments: session pooler, table owner via Hyperdrive, public config in the repo (#21)

Staging and production are separate Supabase Free projects in eu-central-1 and separate Workers (`prompt-hub-staging`, `prompt-hub`); the top-level Wrangler Worker is renamed `prompt-hub-local` so a deploy without `--env` cannot overwrite production. Hyperdrive connects through Supavisor in **session mode** (port 5432) as the `postgres` table owner, the same model as #20: RLS without policies shuts out every other role, and the Data API is turned off. Project refs and Hyperdrive ids sit in `wrangler.jsonc`; Supabase publishable keys (public by design, but flagged by gitleaks) come from GitHub environment variables via `--var`; only DB passwords and the Cloudflare API token are secrets. _Why:_ the direct database host is IPv6 only, transaction mode breaks prepared statements; publishable keys are public by design. Alternatives: a dedicated low-privilege DB role (later, once the schema stabilises); a gitleaks allowlist for the keys (rejected: keeps key-shaped strings in a public repo).

## 2026-10-23 — Phase 1 signs in one hand-created user; invites in Phase 2

Olexiy asked whether invites belong in Phase 1. Phase 1 keeps real authentication (Supabase Auth, sign-up closed, Olexiy's account created by hand, HttpOnly cookie sessions) because the app is on a public URL; invites and Turnstile move to the MVP (Phase 2, feature 103). _Why:_ a "default user" without sign-in would expose private prompts; invite flows are not needed while he is the only user. Alternative: no auth with a default user — rejected.

## 2026-10-23 — Public repository, roadmap of six phases (#5)

The repo is public from now on (Olexiy: names in the history are fine); CodeQL default setup, secret scanning with push protection, Dependabot alerts and security updates, private vulnerability reporting and a `main` ruleset (PR only, squash, no force push or deletion) are on. Phases: 1 Foundation, 2 MVP, 3 v1 ComfyUI workbench, 4 v2 Public and friends, 5 v3 AI and Pro, 6 v4 AI studio; product naming (#7) moved to Phase 5. _Why:_ free GitHub security features need a public repo; phases mirror the agreed versions with a foundation phase first. Licence not chosen yet (all rights reserved until then).

## 2026-10-23 — ADR: TypeScript end to end on Cloudflare Workers (#4)

Frontend React 19 + Primer React, backend Hono on Cloudflare Workers, one Worker serves UI and `/api`, shared Zod schemas and variable renderer in `packages/core`. _Why:_ Olexiy left the stack to Claude with security first and €0; Workers have no server/OS/container to patch, no cold starts on the free plan, one language and one dependency tree, and Primer React gives GitHub's real components. Alternatives: Spring Boot 4.1 native on Google Cloud Run + Angular 22 (revision 1: third vendor, native-image build complexity, two supply chains); Supabase-only with Edge Functions + RLS (logic split, hard to test); Hetzner server (own OS patching, shared with other people's sites).

## 2026-10-23 — ADR: Supabase for Postgres and Auth, via Hyperdrive

Supabase Free in the EU: Postgres (prod + staging projects) and Auth; Drizzle ORM with SQL migrations; the Worker is the only data path (Data API disabled, service key server-side only). _Why:_ managed Postgres + auth in one free project, no passwords stored by us, invites and TOTP built in; a 7-day idle pause is acceptable. Alternatives: Neon (no auth), Cloudflare D1 (SQLite, weaker search and JSON), own auth (more to secure).

## 2026-10-23 — ADR: Security standard OWASP ASVS 5.0 Level 2

Controls from the MVP: invite-only sign-up, Turnstile, HttpOnly cookie sessions, JWT verification via JWKS, server-side authorisation per request with "other user → 404" tests, Zod validation, strict CSP and security headers, rate limiting, secrets only in Wrangler/GitHub secrets, nightly backups. Supply chain: pnpm release-age gate and blocked install scripts, Dependabot, SHA-pinned actions, no `pull_request_target`, gitleaks, OSV-Scanner, CodeQL (Semgrep dropped in #18 once the repo was public); daily scheduled scans; `/security-review` before production deploys touching auth or input. _Why:_ Olexiy treats security as a top priority given AI-assisted attacks; npm worm waves in 2025–2026.

## 2026-10-23 — ADR: Monorepo, modular monolith, CI/CD

pnpm workspaces (`apps/web`, `apps/api`, `packages/core`, `packages/db`, `e2e`); no microservices. CI on pull requests only; preview deploys to staging per PR; production deploy by manual dispatch after Olexiy's go. _Why:_ one deployable is the smallest attack surface and least ops at this scale; process rules from DEV_PROCESS.md.

## 2026-10-23 — Budget €0/month

Free tiers only for now; sleeping DB acceptable. Accounts (Cloudflare, Supabase) are created by Olexiy.

## 2026-10-23 — Feature catalogue and product shape (#3)

Agreed in a brainstorm with Olexiy ([FEATURES.md](FEATURES.md)): project → optional folders → independent prompts → versions created by a button; history visible only to the author; deletes are final everywhere (no trash; project delete asks for its name); no branches, variants or shared blocks; public projects show and fork only latest versions, visitors comment and star; invite-only registration; no integrations (copy & paste); EN/RU/DE UI. _Why:_ keep the core simple and personal first; complexity (block prompts, AI) comes in later versions. Alternatives: Git-style branches (PromptHub), trash with 30-day restore, collaborators with roles — rejected.

## 2026-10-23 — Monetisation designed in, built late

The product is treated as a potential paid service: Free (25 projects, 250 prompts in total) and Pro plans; own AI key on both plans, our AI on Pro through OpenRouter with a configurable per-user budget. Plans and limits are in the data model from the MVP; billing, VAT and merchant of record are decided only if the product is launched. _Why:_ Olexiy wants an "adult" product path without paying the billing cost now. Replaces the earlier non-goal "Monetisation".

## 2026-10-23 — Version split MVP → v4

MVP "my prompts online", v1 "ComfyUI workbench", v2 "public and friends", v3 "AI and Pro", v4 "AI studio" (details in FEATURES.md). Proposed by Claude; Olexiy may stop after any version. _Why:_ each version ends in something used daily, cheapest valuable core first.

## 2026-10-23 — Build our own (market scan, #2)

Olexiy decided to build Prompt Hub rather than adopt or fork an existing product. _Why:_ no product combines GitHub-like public/private projects, per-prompt versions, variables with one-click rendered copy, comments/meta and import; image/video (ComfyUI) prompts are unserved; data ownership and portfolio value matter. Alternatives: adopt PromptHub (prompthub.us, SaaS only, private prompts paid) — rejected; fork prompts.chat (no versioning/variables/private projects) or Langfuse (prompt module of an observability platform) — rejected. Details: [research/market-scan.md](research/market-scan.md). The name "PromptHub" is taken; renaming is decided before anything goes public.

## 2026-10-23 — Discovery before building

Phase 0 runs a market scan, feature catalogue, architecture and roadmap before any code. _Why:_ Olexiy wants to know whether building is worth it at all, and to agree features before architecture. Alternative: start coding an MVP directly — rejected.

## 2026-10-23 — Multi-user, internet-facing from day one

Even with one real user, the design assumes many users, an online DB, authentication and a public-service security posture. _Why:_ Olexiy's explicit requirement; retrofitting multi-tenancy and auth is expensive. Alternative: local single-user tool — rejected.

## 2026-10-23 — Private repo, GitHub-visible process

Repo `olexiy/prompt-hub` is private; work follows `DEV_PROCESS.md` in full (milestones, epics, sub-issues). _Why:_ defaults of Olexiy's dev process; the repo can go public later.
