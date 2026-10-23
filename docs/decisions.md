# Decisions

Newest first. Format: date — decision. _Why._ Alternatives considered.

## 2026-10-23 — Phase 1 signs in one hand-created user; invites in Phase 2

Olexiy asked whether invites belong in Phase 1. Phase 1 keeps real authentication (Supabase Auth, sign-up closed, Olexiy's account created by hand, HttpOnly cookie sessions) because the app is on a public URL; invites and Turnstile move to the MVP (Phase 2, feature 103). _Why:_ a "default user" without sign-in would expose private prompts; invite flows are not needed while he is the only user. Alternative: no auth with a default user — rejected.

## 2026-10-23 — Public repository, roadmap of six phases (#5)

The repo is public from now on (Olexiy: names in the history are fine); CodeQL default setup, secret scanning with push protection, Dependabot alerts and security updates, private vulnerability reporting and a `main` ruleset (PR only, squash, no force push or deletion) are on. Phases: 1 Foundation, 2 MVP, 3 v1 ComfyUI workbench, 4 v2 Public and friends, 5 v3 AI and Pro, 6 v4 AI studio; product naming (#7) moved to Phase 5. _Why:_ free GitHub security features need a public repo; phases mirror the agreed versions with a foundation phase first. Licence not chosen yet (all rights reserved until then).

## 2026-10-23 — ADR: TypeScript end to end on Cloudflare Workers (#4)

Frontend React 19 + Primer React, backend Hono on Cloudflare Workers, one Worker serves UI and `/api`, shared Zod schemas and variable renderer in `packages/core`. _Why:_ Olexiy left the stack to Claude with security first and €0; Workers have no server/OS/container to patch, no cold starts on the free plan, one language and one dependency tree, and Primer React gives GitHub's real components. Alternatives: Spring Boot 4.1 native on Google Cloud Run + Angular 22 (revision 1: third vendor, native-image build complexity, two supply chains); Supabase-only with Edge Functions + RLS (logic split, hard to test); Hetzner server (own OS patching, shared with other people's sites).

## 2026-10-23 — ADR: Supabase for Postgres and Auth, via Hyperdrive

Supabase Free in the EU: Postgres (prod + staging projects) and Auth; Drizzle ORM with SQL migrations; the Worker is the only data path (Data API disabled, service key server-side only). _Why:_ managed Postgres + auth in one free project, no passwords stored by us, invites and TOTP built in; a 7-day idle pause is acceptable. Alternatives: Neon (no auth), Cloudflare D1 (SQLite, weaker search and JSON), own auth (more to secure).

## 2026-10-23 — ADR: Security standard OWASP ASVS 5.0 Level 2

Controls from the MVP: invite-only sign-up, Turnstile, HttpOnly cookie sessions, JWT verification via JWKS, server-side authorisation per request with "other user → 404" tests, Zod validation, strict CSP and security headers, rate limiting, secrets only in Wrangler/GitHub secrets, nightly backups. Supply chain: pnpm release-age gate and blocked install scripts, Dependabot, SHA-pinned actions, no `pull_request_target`, gitleaks, OSV-Scanner, Semgrep; daily scheduled scans; `/security-review` before production deploys touching auth or input. _Why:_ Olexiy treats security as a top priority given AI-assisted attacks; npm worm waves in 2025–2026.

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
