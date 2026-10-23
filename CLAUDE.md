# Prompt Hub

A web app for storing, versioning and reusing AI prompts: projects contain prompts, every prompt has a version history, variables filled in at use time, comments and meta fields, public/private projects like GitHub, import of single prompts or whole projects, and one-click copy of the rendered prompt. Built first for Olexiy (ComfyUI and LLM work), but designed from day one as a **multi-user, internet-facing service**: hosted online DB, user authentication, proper security standards. Repository: `olexiy/prompt-hub` (private). Working name; a name clash with an existing product is checked in the market scan.

**Reply to Olexiy in Russian.** Everything in the repo and on GitHub is English.

## Read before working

- `docs/brief.md` — Olexiy's original idea. The starting point for features.
- `docs/PROJECT_PLAN.md` — goals, phases and exit criteria. **Authoritative.**
- `docs/DEV_PROCESS.md` — full development playbook: GitHub setup, issue/PR formats, CI rules, testing, approval gates, gotchas. The process block below is its summary.
- `docs/decisions.md` — decision log. Append an entry whenever a non-obvious choice is made.
- `docs/findings-log.md` — observations, measurements, things that did not work.

## Start of every session

1. `git pull`, then `gh issue list --state open`.
2. Read the latest handoff comment on the current phase epic.
3. Continue with the next open issue of the current phase in the order the handoff gives. If nothing is clear, ask.

When Olexiy says «работай над проектом» / "work on the project", this is the procedure.

## Current phase: 1 — Foundation (epic #10)

Phase 0 is done: build decided, features and versions in `docs/FEATURES.md`, architecture in `docs/research/architecture.md`, phases 1–6 as milestones and epics. Phase 1 order: #16 mockups → #17 skeleton → #18 CI → #19 test harness → #20 DB schema → #21 environments (needs Olexiy's Cloudflare + Supabase accounts) → #22 single-user sign-in (invites in Phase 2) → #23 security baseline → #24 app shell → #25 vertical slice.

- **The repo is public:** never commit secrets, personal data or run data; push protection and gitleaks are a safety net, not the plan.
- **Feature talk with Olexiy:** he dictates by voice; collect ideas as a numbered list first, prioritise afterwards. Feature IDs in `docs/FEATURES.md` are stable references.

## Stack

TypeScript end to end (decided 2026-10-23, #4): React 19 + Primer React (Vite) and a Hono API in one Cloudflare Worker; Supabase Postgres + Auth (EU) via Hyperdrive, Drizzle ORM; R2 for files from v1; pnpm monorepo `apps/web`, `apps/api`, `packages/core`, `packages/db`, `e2e`. Security standard OWASP ASVS 5.0 L2. Details: `docs/research/architecture.md`, ADRs in `docs/decisions.md`. Web-search current stable versions before adding or upgrading anything; respect the pnpm release-age gate.

## Commands

pnpm is not installed globally: call it as `corepack pnpm …` (Node 24 ships corepack); inside scripts the pinned root devDependency `pnpm` is used.

| Command                                                        | What it does                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `corepack pnpm install`                                        | install (release-age gate 3 days, dependency build scripts only as allowed in `pnpm-workspace.yaml`) |
| `corepack pnpm dev`                                            | build the web app, run the Worker locally on http://localhost:8787 (UI + `/api`)                     |
| `corepack pnpm dev:web`                                        | Vite dev server with hot reload, proxies `/api` to :8787 (run `dev` alongside)                       |
| `corepack pnpm lint` / `format` / `format:check` / `typecheck` | ESLint (strict type-checked), Prettier, `tsc` per package                                            |
| `corepack pnpm build`                                          | Vite build + `wrangler deploy --dry-run` bundle                                                      |
| `corepack pnpm test`                                           | Vitest: core unit tests, API tests in the Workers runtime                                            |
| `corepack pnpm e2e`                                            | Playwright on :8788 with the installed Edge/Chrome (run `build` first); see `docs/testing.md`        |

Gotchas: TypeScript stays on 6.0.x until typescript-eslint supports 7; Primer's `ThemeProvider` comes from `@primer/react/next`.

## Environment

Checked 2026-10-23: Windows 11, RTX 5070 Ti 16 GB, JDK 21, Node 24, Python 3.13 (`python`, not `python3`), Docker 29, `gh` 2.98 (logged in as `olexiy`). Olexiy works on two computers; the repo and GitHub are the sync point.

## Project rules

- **Mode:** Claude leads — Claude drives implementation through the task cycle.
- **Ask first:** creating accounts or paid plans on any hosting/DB/auth provider (Olexiy signs up himself), any recurring cost, deploys (check identity + target), opening sites he did not name, downloads.
- **Pre-approved (2026-10-23, Phase 1):** pnpm via corepack and installing the project's npm packages inside the repo, with the pnpm release-age gate on; local Supabase in Docker (`supabase start`, image pulls) and starting Docker Desktop for it. Global installs and other downloads still need a go.
- **Security is a requirement, not a later phase:** auth, authorization per project/prompt, input validation, secrets only in env/secret stores, never in git or issues.
- Multi-user from the start: every data model and API decision assumes many users and tenants, even while Olexiy is the only user.

### Development process (mandatory, no exceptions)

Progress must be visible on GitHub at any moment. **No line of code without an open issue that is taken in progress.** Full playbook with commands and reasons: `docs/DEV_PROCESS.md`.

**Structure.** Milestone = plan phase. Epic = issue labelled `phase-N`. Before a phase starts, split its epic into tasks; each task gets the `phase-N` label, the milestone, and is linked to the epic as a **sub-issue**. Task body: _Goal_, _Subtasks_ (`- [ ]`), _Acceptance criteria_ (`- [ ]`, checkable). A task bigger than ~1 day or with more than 5 subtasks is split into sub-issues. Findings, bugs and debts found on the way become new issues (`bug`, `tech-debt`, `security`) linked to the epic, never folded into the current task.

**Task cycle.**

1. **Take:** assignee `@me` + label `in-progress` + comment "Started" with the plan. Branch `N-short-slug` from a fresh `main`.
2. **Do:** code with docstrings/comments; tick subtasks in the issue as they finish.
3. **Verify locally:** lint, format check, tests, build, e2e; UI changes checked in the built-in browser with screenshots and no console errors.
4. **Docs:** update README / `docs/` / findings log touched by the change, in the same PR.
5. **PR** `Closes #N` → **CI green** → squash merge (`gh pr merge --squash --delete-branch`) → `git checkout main && git pull`. Red CI: fix in the same branch, never merge red.
6. **Close:** check every acceptance criterion and the DoD, tick the checklists, comment what was done and how it was verified (test counts, screenshots, deviations, new issues), remove `in-progress`, confirm the issue is closed.
7. **Next task** only after step 6. One task in the working tree at a time.
8. **Phase end:** all sub-issues closed → summary comment on the epic, close epic and milestone, visual review with Olexiy.

**Definition of Done.** Acceptance criteria met _and verified_ (not "should work") · new code covered by tests, all tests and linters green locally and in CI · UI checked in the browser, key screenshots, no console errors · no secrets, run data or debug junk in the diff · docs updated · PR merged, issue closed with a comment, `in-progress` removed, epic shows progress · found debts filed as issues.

**Session start:** `git pull`, `gh issue list --state open`, read the handoff comment on the current epic. GitHub issues are the source of truth for "what next", not chat history.

**Language:** chat with Olexiy in Russian. Code, identifiers, branch names, commits, PRs and issues in English, even when he names things in Russian.

## Improving the process

The process comes from the vault note `wiki/devops/workflows/claude-dev-process.md` (copied 2026-10-23). When a rule changes here or a new lesson appears, update `docs/DEV_PROCESS.md` and tell Olexiy "port to vault: …" so future projects get it.
