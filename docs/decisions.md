# Decisions

Newest first. Format: date — decision. *Why.* Alternatives considered.

## 2026-10-23 — Discovery before building
Phase 0 runs a market scan, feature catalogue, architecture and roadmap before any code. *Why:* Olexiy wants to know whether building is worth it at all, and to agree features before architecture. Alternative: start coding an MVP directly — rejected.

## 2026-10-23 — Multi-user, internet-facing from day one
Even with one real user, the design assumes many users, an online DB, authentication and a public-service security posture. *Why:* Olexiy's explicit requirement; retrofitting multi-tenancy and auth is expensive. Alternative: local single-user tool — rejected.

## 2026-10-23 — Private repo, GitHub-visible process
Repo `olexiy/prompt-hub` is private; work follows `DEV_PROCESS.md` in full (milestones, epics, sub-issues). *Why:* defaults of Olexiy's dev process; the repo can go public later.
