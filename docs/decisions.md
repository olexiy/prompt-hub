# Decisions

Newest first. Format: date — decision. *Why.* Alternatives considered.

## 2026-10-23 — Feature catalogue and product shape (#3)
Agreed in a brainstorm with Olexiy ([FEATURES.md](FEATURES.md)): project → optional folders → independent prompts → versions created by a button; history visible only to the author; deletes are final everywhere (no trash; project delete asks for its name); no branches, variants or shared blocks; public projects show and fork only latest versions, visitors comment and star; invite-only registration; no integrations (copy & paste); EN/RU/DE UI. *Why:* keep the core simple and personal first; complexity (block prompts, AI) comes in later versions. Alternatives: Git-style branches (PromptHub), trash with 30-day restore, collaborators with roles — rejected.

## 2026-10-23 — Monetisation designed in, built late
The product is treated as a potential paid service: Free (25 projects, 250 prompts in total) and Pro plans; own AI key on both plans, our AI on Pro through OpenRouter with a configurable per-user budget. Plans and limits are in the data model from the MVP; billing, VAT and merchant of record are decided only if the product is launched. *Why:* Olexiy wants an "adult" product path without paying the billing cost now. Replaces the earlier non-goal "Monetisation".

## 2026-10-23 — Version split MVP → v4
MVP "my prompts online", v1 "ComfyUI workbench", v2 "public and friends", v3 "AI and Pro", v4 "AI studio" (details in FEATURES.md). Proposed by Claude; Olexiy may stop after any version. *Why:* each version ends in something used daily, cheapest valuable core first.

## 2026-10-23 — Build our own (market scan, #2)
Olexiy decided to build Prompt Hub rather than adopt or fork an existing product. *Why:* no product combines GitHub-like public/private projects, per-prompt versions, variables with one-click rendered copy, comments/meta and import; image/video (ComfyUI) prompts are unserved; data ownership and portfolio value matter. Alternatives: adopt PromptHub (prompthub.us, SaaS only, private prompts paid) — rejected; fork prompts.chat (no versioning/variables/private projects) or Langfuse (prompt module of an observability platform) — rejected. Details: [research/market-scan.md](research/market-scan.md). The name "PromptHub" is taken; renaming is decided before anything goes public.

## 2026-10-23 — Discovery before building
Phase 0 runs a market scan, feature catalogue, architecture and roadmap before any code. *Why:* Olexiy wants to know whether building is worth it at all, and to agree features before architecture. Alternative: start coding an MVP directly — rejected.

## 2026-10-23 — Multi-user, internet-facing from day one
Even with one real user, the design assumes many users, an online DB, authentication and a public-service security posture. *Why:* Olexiy's explicit requirement; retrofitting multi-tenancy and auth is expensive. Alternative: local single-user tool — rejected.

## 2026-10-23 — Private repo, GitHub-visible process
Repo `olexiy/prompt-hub` is private; work follows `DEV_PROCESS.md` in full (milestones, epics, sub-issues). *Why:* defaults of Olexiy's dev process; the repo can go public later.
