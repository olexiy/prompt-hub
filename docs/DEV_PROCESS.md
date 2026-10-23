> Copied from the vault note wiki/devops/workflows/claude-dev-process.md on 2026-10-23. Improvements: edit here and tell Olexiy "port to vault: …".

# Claude Dev Process

How Olexiy and Claude build software together: every step visible on GitHub, verified before it is called done, and resumable by a fresh session. Distilled from `model-proving-ground` (`C:\dev\local-llm-bench`, where this process was used in full and worked well) and from the CLAUDE.md files and project memories of the other repos in `C:\dev`.

**Single source of truth.** The `software-project-initiator` skill (`.claude/skills/software-project-initiator/`) copies this file into every new repo as `docs/DEV_PROCESS.md`, and copies the block between the `core` markers into the repo's `CLAUDE.md`. A repo keeps its copy, so it never depends on the vault path. When a project improves a rule, port the change back here so the next project gets it.

Related: Webdev lessons learned (website-specific rules) · ComfyUI Agent Playbook (local-AI specifics).

## 1. Core rules (copied into each project's CLAUDE.md)

<!-- core:start -->

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
<!-- core:end -->

## 2. GitHub setup for a new repo

- Repo **private by default**; quality as if it were public (no secrets, no run data, clean history), so it can be opened later.
- Labels: `phase-1`…`phase-N` (one per plan phase, with the phase name as description), `in-progress`, `tech-debt`, `security`, plus GitHub's defaults (`bug`, `enhancement`, `documentation`).
- Milestones `Phase N - <name>`, one epic issue per phase (`Phase N: <name>`, label `phase-N`, milestone set, body = phase goal + exit criteria from the plan).
- Link a task to its epic as a sub-issue:
  ```bash
  id=$(gh api repos/<owner>/<repo>/issues/<task> --jq .id)
  gh api -X POST repos/<owner>/<repo>/issues/<epic>/sub_issues -F sub_issue_id=$id
  ```
- `.gitattributes` with `* text=auto eol=lf` from the first commit (Windows checkouts otherwise produce CRLF diffs).
- `.gitignore` covers data, artifacts, `.env*`, local DBs, logs, screenshots outside `docs/`.

## 3. Issue and PR formats

Issue body:

```markdown
Part of #<epic>.

## Goal

<one or two sentences: what the user gets>

## Subtasks

- [ ] …

## Acceptance criteria

- [ ] <checkable statement>
- [ ] No console errors.
```

Comments on the issue: **"Started. Plan: …"** when taking it; **"Done in #PR. <what>. Checked: <unit N, e2e N, build, CI green>; visual check on <data>, no console errors."** when closing.

PR body: `Closes #N (part of #epic)`, then bullets of what changed, a **Checks:** line with numbers, a **Visual check:** line for UI work. Title = what the user gets, not the file list.

## 4. CI and GitHub Actions minutes

Private repos get 2000 free Actions minutes per month; every push re-runs CI. Rules from `model-proving-ground`:

- CI runs on `pull_request` and `workflow_dispatch` only, **not on push to `main`** (a squash merge lands exactly what the PR checked).
- `dorny/paths-filter` decides which jobs run (backend / frontend / suites); a docs-only PR runs no test jobs. Manual dispatch runs everything.
- `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`.
- **Run all checks locally first, push once per task.** Doc tweaks go into the task's PR, not separate PRs. Small notes go as comments on existing issues instead of new ones.
- Upload the Playwright report as an artifact only on failure, short retention.
- Reference implementation: `C:\dev\local-llm-bench\.github\workflows\ci.yml`.

## 5. Testing

- **Pick the cheapest layer that proves the thing** (examo): backend integration tests against the real DB/API are the TDD entry point; a thin e2e spec only confirms the wiring composes.
- **Backend logic test-first:** write the spec, watch it fail _for the right reason_, then implement. A test that passes before the code exists tests the wrong thing.
- **No mock-heavy unit tests** of internals: they rot and duplicate e2e coverage. Mock at the boundary only (e.g. a `mock` provider that replays recorded streams so UI work needs no GPU or paid API).
- **Keep e2e in sync with reality** in the same commit that changes behaviour. A green suite exercising stale flows lies.
- e2e runs on its own ports with a temporary DB so it never touches dev data.
- **Verify on the real thing**, not just types and build: open the page in the browser, run against the real backend, check the deployed result. Several past bugs (CSP blocking JS on prod, GA4 beacons blocked, draft noindex) were invisible to local checks.

## 6. Docs, decisions and session continuity

- **CLAUDE.md is a short index** (starfall-v2): what the project is, stack, commands, where things are, project rules, the core process block. Details live in `docs/`; read only the file the task needs.
- `docs/PROJECT_PLAN.md`: goals and non-goals, architecture, key decisions table, phases with exit criteria. Authoritative.
- **Persist every decision made in chat** before the session ends (devops_lab_1): plan changes → `docs/PROJECT_PLAN.md`, non-obvious choices → `docs/decisions.md` (date, decision, why, alternatives). Chat is lost on `/clear` and compaction.
- **Update docs as progress happens**, not later (olexiydoes): tick steps, write actual values, keep a status block on top of runbooks.
- `docs/findings-log.md` for observations that are not decisions (measurements, surprises, things that did not work).
- **Session handoff:** before stopping, write a handoff comment on the current epic (what is merged, next issue order, items blocked on Olexiy, gotchas). A cloud session or the other computer can read it; local memory cannot.
- Work may happen in a cloud session too: start with `git pull` and a look at recent PRs before assuming state.
- When a manual workflow has been done 2–3 times, propose turning it into a project skill (`.claude/skills/`) or subagent (`.claude/agents/`). New subagents are visible only in a new session.

## 7. Working with Olexiy

- **He wants to see the process.** Short progress reports after each meaningful step; show real output (screenshots, sample results), not just "done".
- **Recommendations, not option lists.** He decides at forks but expects a recommended choice with the reason.
- **Decisions first** in any report or long answer: a numbered list of what needs his decision or action, then what was done, then detail.
- **Ask for what you need** (access, a manual step, data, a key) instead of engineering around a gap; put blocked items in the handoff as "blocked on Olexiy".
- **Mode is set per project at intake:**
  - _Claude leads_ (default): Claude drives implementation through the task cycle.
  - _Advisor_ (hermes): Olexiy drives setup himself to learn. Claude runs infrastructure checks and answers, but does not run setup wizards, pre-write configs, or click through web UIs for him.
- **Client projects:** never change approved visuals or client-supplied content on your own aesthetic judgment (nagelstudio UI freeze). Propose, get the OK, then change. Score-relevant fixes that touch visuals: surface the trade-off, let him decide.
- Push back on wasteful plans; point out problems freely.

## 8. Approval gates (always ask first)

- Downloads (state file, source, size, target folder), paid API calls, buying anything.
- **Using the GPU** for real runs: he may be gaming on the same card. Ask, and unload the model right after (`lms unload --all`).
- System settings, drivers, BIOS, global installs.
- **Opening any page or site he did not name** (avigea): the browser is signed into personal and client accounts. Applies to reading too.
- Deploys: before any deploy check **identity** (logged-in account) and **target** (site/project id). Preview deploys may be pre-authorized per project and recorded in that project's CLAUDE.md; production is a separate explicit go every time.
- Creating public repos, publishing, posting, messaging anyone.
- Note: in a repo that follows this process, the task cycle itself authorizes branch commits, pushing, the PR and the squash merge after green CI. Outside the task cycle (vault, finance) the rule is "don't commit unless asked".

## 9. Autonomous and long runs

- Pattern from examo's infra build: an **orchestrator session dispatches one subagent per step**; each step has an **acceptance command** that must be green (no fake green), writes a short build-log entry, and the orchestrator verifies cheaply and commits per step. State lives in the plan file and a ledger on disk, never in chat, so the run resumes from the first unchecked box.
- Large evaluations or reviews go to a subagent to keep the main context clean (model-proving-ground's `judge`). Scoring must come from one consistent evaluator to stay comparable.
- One hard abort (e.g. wrong deploy identity), everything else: log to the issue / TODO with an owner and continue.
- Long waits (CI, builds, test runs) run in the background; don't poll.

## 10. Versions and stack hygiene

- **Web-search the current stable version** of every framework and library before writing or reviewing code; never trust memory for versions or APIs. Record known breaking changes in CLAUDE.md (devops_lab_1 kept Spring Boot 4 / Jackson 3 / Spring Cloud Gateway 5 notes there; starfall-v2 pointed Next.js work at the docs inside `node_modules`).
- Pin tool versions that are known to work and record why (examo pinned Helm 3.18.4 for a Windows symlink bug).
- Use the framework's official MCP/skill before frontend or DB work when the project has one (Angular CLI MCP, `supabase:supabase`).
- Before merge of risky changes run `/code-review`; before publishing run `/security-review`.

## 11. Windows and tooling gotchas

- `python`, not `python3`.
- Bash tool: a heredoc combined with `</dev/null` or a bare `cat > file` can hang; write scripts with the Write tool instead. Heredocs also eat backslashes.
- Python `write_text` on Windows writes CRLF: run the formatter after scripted edits.
- `curl` with non-ASCII JSON bodies breaks in Git Bash: call the API through the project's CLI or a script.
- `git add -A` picks up loose binaries in the repo root: add explicit paths.
- Secret guard: a pre-commit hook that blocks keys, IBANs and data paths (finance `scripts/guard_commit.py`); git hooks are not synced, reinstall on each machine.
- Smart App Control is enforced: a binary that silently fails to launch → check Event Viewer, CodeIntegrity event 3077, first.
- Docker Desktop fragility: `wsl --shutdown` and a clean restart before reinstalling.

## 12. Sources

| Repo (`C:\dev\…`)                        | What it contributed                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `local-llm-bench` (model-proving-ground) | Full GitHub process, DoD, CI minutes rules, issue/PR formats, mock provider, judge subagent, GPU gate, handoff |
| `examo`                                  | Test layering and TDD order, ADR log, orchestrator + subagent autonomous run                                   |
| `devops_lab_1`                           | Persist plans before session end, web-search versions, breaking-change notes in CLAUDE.md                      |
| `starfall-v2`                            | CLAUDE.md as short index, docs table "when to read"                                                            |
| `finance`                                | Coach mode, "ask for what you need", commit guard hook, skills from repeated workflows                         |
| `avigea`, `avigea_bot`                   | Deploy identity + target check, browser navigation permission, English-only code and branches                  |
| `hermes`                                 | Advisor mode, Docker isolation, Docker Desktop recovery                                                        |
| `olexiydoes`                             | Update docs immediately as progress happens                                                                    |
| `nagelstudio_elena_kaiser`               | Client UI freeze and content rules                                                                             |
| webdev `_template/lessons_learned.md`    | Verify on the real deploy, one hard abort                                                                      |
