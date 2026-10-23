# Prompt Hub — project plan

> Store, version and reuse AI prompts: projects → prompts → versions, variables, comments, meta fields, public/private sharing, import, one-click copy.

Related: [brief.md](brief.md) · [DEV_PROCESS.md](DEV_PROCESS.md) · [decisions.md](decisions.md) · [findings-log.md](findings-log.md)

## Open questions
1. **Hosting budget** — monthly ceiling for hosting + DB + auth. Not answered at bootstrap; ask in the architecture task. Recommendation to discuss: free tiers where they are not a trap, a hard ceiling around €10–25/month.
2. **Build, fork or adopt** — answered by the market scan.
3. **Name** — "PromptHub" may be taken by an existing product; check in the market scan, rename before anything public.

## 1. Goals and non-goals

**Goals**
- One place for all of Olexiy's prompts (image/video generation, LLM, coding), with history, so a good prompt never gets lost or overwritten.
- Prompts as templates: variables, filled in at use time, one-click copy of the rendered result.
- Multi-user, internet-facing from day one: accounts, private and public projects, a security posture fit for a public service.
- A portfolio-quality codebase and a GitHub-visible process.

**Non-goals (for now)**
- Running prompts against models, evaluation, tracing or observability (LLMOps platforms do this; decide in the market scan whether any of it belongs in scope).
- Monetisation, teams/organisations billing.

## 2. Architecture
To be decided in Phase 0 (architecture task): stack, hosting, DB, auth provider, security standard (e.g. OWASP ASVS level), cost. Recorded here plus ADRs in `decisions.md`.

## 3. Phases

Each phase = a GitHub milestone + epic issue (`phase-N`). Tasks are created when the phase starts.

### Phase 0 — Discovery
**Goal:** decide whether, what, how and in which order to build.
**Tasks:** market scan (build vs. adopt) · feature catalogue and v1 scope · architecture and stack · roadmap on GitHub.
**Exit criteria:**
- [ ] Market scan done; Olexiy decided build / fork / adopt.
- [ ] Feature catalogue with priorities; v1 scope agreed with Olexiy.
- [ ] Architecture, stack, hosting and security standard decided and recorded as ADRs.
- [ ] Development phases exist as milestones + epics; Phase 1 split into tasks.

### Phase 1 onwards
Defined by the roadmap task. Phase 1 starts with the project skeleton, CI (see `ci-pattern.yml`) and the first vertical slice.

## 4. Risks
| Risk | Mitigation |
|---|---|
| A mature product already covers the need | Market scan first; stopping after Phase 0 is an acceptable outcome |
| Scope creep from "many more features" | Explicit v1 scope with won't-have list |
| Hosting costs or free-tier traps (DB pausing, cold starts) | Budget ceiling decided up front; check free-tier limits online |
| Security of a public multi-user service | Security standard chosen in Phase 0, checks in the DoD, `/security-review` before going public |

## 5. Status
| Phase | State |
|---|---|
| 0 — Discovery | not started |
