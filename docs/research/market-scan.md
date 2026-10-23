# Market scan — prompt managers, build vs. adopt

Issue #2 · checked online on **2026-10-23** (GitHub numbers from the GitHub API that day; prices from the vendors' pricing pages unless marked).

## TL;DR

- **Nothing on the market matches the brief as a whole.** The products split into three camps, and each misses a different piece:
  1. **LLMOps platforms** (Langfuse, Agenta, PromptLayer, Latitude, Pezzo) version prompts well, but for _developers shipping an LLM app_: prompts are fetched by SDK, there is no public/private sharing, no one-click "fill variables and copy", nothing for image/video prompts.
  2. **Prompt libraries / SaaS** (PromptHub, prompts.chat, many small apps) have sharing and discovery, but either no versioning (prompts.chat), or private prompts only on a paid plan with no self-hosting (PromptHub).
  3. **Local tools** (ComfyUI nodes, text expanders) are single-user and on one machine; none of the ComfyUI nodes versions a prompt.
- **Closest fits:** PromptHub (SaaS; Git-style versions, public/private, stars and forks) and Open WebUI's prompt workspace (versions with diff, typed variables, private/shared/public), but the second is a feature inside a chat UI, not a prompt hub.
- **Recommendation: build**, and borrow the best ideas (see §5). The name **"Prompt Hub" is taken** (PromptHub, prompthub.us) and must change before anything goes public.

## 1. Candidates

| #   | Product                                                                                      | Camp                                    | Hosting                                                             | Licence                                           | Price (on the day)                                                                                                                    | Activity                               |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | [PromptHub](https://www.prompthub.us/)                                                       | SaaS library + team prompt tool         | SaaS only                                                           | proprietary                                       | Free: unlimited **public** prompts, 2,000 requests/mo. Pro $12/mo ($9 annual), 1 user, private prompts. Team $20/user/mo ($15 annual) | active; G2-listed                      |
| 2   | [Langfuse](https://github.com/langfuse/langfuse)                                             | LLMOps                                  | cloud or self-host (Docker/K8s, Postgres + ClickHouse + Redis + S3) | MIT core, `ee/` commercial                        | self-host free, unlimited; cloud Hobby free, Core $29/mo, Pro $199/mo ([pricing](https://langfuse.com/pricing-self-host))             | 36.3k ★, pushed today                  |
| 3   | [Open WebUI](https://github.com/open-webui/open-webui) — Prompts workspace                   | chat UI with prompt library             | self-host                                                           | Open WebUI License (BSD-3 with a branding clause) | free                                                                                                                                  | 156.6k ★, pushed today                 |
| 4   | [prompts.chat](https://github.com/f/prompts.chat) (ex Awesome ChatGPT Prompts)               | public library, self-hostable           | SaaS or self-host (Next.js + PostgreSQL + Prisma)                   | code MIT, prompts CC0                             | free                                                                                                                                  | 174.2k ★, pushed today                 |
| 5   | [Agenta](https://github.com/agenta-ai/agenta)                                                | LLMOps                                  | cloud or self-host                                                  | MIT (OSS edition)                                 | self-host free; cloud Business $299/mo, Pro price differs between sources ($29 / $49)                                                 | 4.9k ★, pushed today                   |
| 6   | [PromptLayer](https://promptlayer.com/pricing)                                               | LLMOps, prompt registry                 | SaaS (self-host only Enterprise)                                    | proprietary                                       | Free: 5 users, 2.5k requests/mo, registry capped at 10 prompts (third-party); Pro $49/mo; Team $500/mo                                | active                                 |
| 7   | [Latitude](https://github.com/latitude-dev/latitude-llm)                                     | LLMOps (now "observability for agents") | cloud or self-host                                                  | MIT                                               | free self-host                                                                                                                        | 4.7k ★, pushed today                   |
| 8   | [Pezzo](https://github.com/pezzolabs/pezzo)                                                  | LLMOps                                  | self-host                                                           | Apache-2.0                                        | free                                                                                                                                  | 3.3k ★, last push 2026-08-21 (slowing) |
| 9   | [ComfyUI_PromptManager](https://github.com/ComfyAssets/ComfyUI_PromptManager) (ComfyAssets)  | ComfyUI node + web UI                   | local, SQLite                                                       | MIT                                               | free                                                                                                                                  | 177 ★, pushed today                    |
| 10  | [ComfyUI-Prompt-Manager](https://github.com/FranckyB/ComfyUI-Prompt-Manager) (FranckyB)      | ComfyUI node                            | local files                                                         | GPL-3.0                                           | free                                                                                                                                  | 168 ★                                  |
| 11  | [Fictiverse ComfyUI_Prompt_Manager](https://github.com/Fictiverse/ComfyUI_Prompt_Manager)    | ComfyUI node, snippet presets           | local JSON                                                          | GPL-3.0                                           | free                                                                                                                                  | 25 ★                                   |
| 12  | [Espanso](https://github.com/espanso/espanso) / [Raycast Snippets](https://www.raycast.com/) | text expander                           | local; Raycast cloud sync on Pro (~$8–10/mo)                        | GPL-3.0 / proprietary                             | free / freemium                                                                                                                       | 14.7k ★ / active                       |

Also seen, not shortlisted: LangSmith Prompt Hub (inside LangSmith, self-host only Enterprise), PostHog prompt management (beta inside product analytics), MLflow Prompt Registry, Arize Phoenix, ~40 small GitHub prompt managers (all < 35 ★, e.g. [promptVault](https://github.com/SagarBiswas-MultiHAT/promptVault), [promptify](https://github.com/sarthakpranesh/promptify)), many iOS/Chrome apps (PromptPad, PromptKit, PromptDock, FlashPrompt), Notion templates sold on Gumroad.

## 2. Brief requirements vs. top candidates

✅ yes · 🟡 partial · ❌ no · ? not verified

| Requirement (brief)                    | PromptHub                             | Langfuse                                                        | Open WebUI prompts                                                | prompts.chat                                       | ComfyUI_PromptManager           | Espanso / Raycast               |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- | ------------------------------- | ------------------------------- |
| Projects → prompts                     | ✅ projects                           | 🟡 project = tenant; virtual folders via `/` in the name        | ❌ flat list + tags                                               | 🟡 categories                                      | 🟡 categories, folders          | ❌                              |
| Versioning                             | ✅ Git-style branches and commits     | ✅ immutable numbered versions, labels (`production`, `latest`) | ✅ versions with commit message, diff, restore                    | ❌                                                 | ❌ (usage counts only)          | ❌                              |
| Variables, filled at use time          | 🟡 via API `variables` object         | ✅ `{{var}}`, compiled in SDK                                   | ✅ `{{name}}`, **typed fields** (select, number, date, checkbox…) | ?                                                  | ❌                              | 🟡 forms / dynamic placeholders |
| Comments                               | ?                                     | ❌                                                              | ❌                                                                | ❌                                                 | ❌                              | ❌                              |
| Meta fields                            | ?                                     | 🟡 `config` JSON, tags                                          | 🟡 tags                                                           | 🟡                                                 | ✅ ratings, tags, linked images | ❌                              |
| Public / private like GitHub           | ✅ but private only on paid plans     | ❌ (RBAC per project in Enterprise)                             | ✅ private / users+groups / public                                | 🟡 public library; private = run your own instance | ❌ single user                  | ❌                              |
| Import single prompt / whole project   | ?                                     | 🟡 API / SDK import                                             | ?                                                                 | 🟡 seed import                                     | ✅ JSON/CSV export, backup      | 🟡 YAML files                   |
| One-click copy with variables filled   | ? (built to run prompts, not to copy) | ❌ (playground only)                                            | 🟡 inserts into the chat, not the clipboard                       | ✅ copy (no variables)                             | ❌ (feeds the node)             | ✅ expands in place             |
| Image/video prompts (ComfyUI use case) | ❌ text/chat LLMs                     | ❌                                                              | ❌                                                                | 🟡 some image prompts                              | ✅                              | 🟡 any text                     |
| Multi-user, online, auth               | ✅                                    | ✅                                                              | ✅                                                                | ✅ (GitHub/Google/Azure AD)                        | ❌                              | ❌                              |
| Own the data / self-host               | ❌                                    | ✅                                                              | ✅                                                                | ✅                                                 | ✅ local                        | ✅ local                        |

**Reading the table:** PromptHub covers most rows but is SaaS-only and keeps private prompts behind a subscription; Langfuse and Open WebUI are strong on versions and variables but have no notion of public projects a stranger can browse, star or fork; nothing combines versioned _projects_ with variables, comments and one-click rendered copy, and nothing is built around long image/video shot-list prompts.

## 3. User voices

- HN, [Show HN: I made an AI prompt manager to stop rewriting the same prompts](https://news.ycombinator.com/item?id=44123511) (2025-05, 9 comments): people keep prompts in "Notion, Apple Notes, random files everywhere"; one commenter worries a prompt library is just one more place where prompts get lost; the asks are fill-in templates with parameters and search by intent.
- HN Show HN search "prompt manager" ([Algolia](https://hn.algolia.com/?query=prompt%20manager&type=story&dateRange=all&prefix=false&sort=byPopularity&tags=show_hn)): 20+ launches since 2023 (Echostash, Promptlight, PromptTray, FlashPrompt, PromptKelp, Promptty…), **none above 7 points**. The space is crowded with small tools and none has broken out — a sign that the need is real but the existing offerings do not stick.
- Langfuse GitHub issues show where a developer tool hurts for non-ASCII prompt work: variables with Japanese/Unicode names were broken until 2026 ([#11509](https://github.com/langfuse/langfuse/pull/11509), 21 reactions; [#17949](https://github.com/langfuse/langfuse/issues/17949), [#18999](https://github.com/langfuse/langfuse/issues/18999) still open). Olexiy writes prompts in Russian and Ukrainian too.
- ComfyUI side: the most-starred "prompt manager" repos are really **galleries** that recover prompts from generated images ([smart-comfyui-gallery](https://github.com/biagiomaf/smart-comfyui-gallery) 395 ★, [Image-MetaHub](https://github.com/LuqP2/Image-MetaHub) 334 ★). ComfyUI users find prompts again through outputs, not through a library — worth considering as a feature (attach result images to a version).
- Reddit could not be read: the search engine returns no reddit.com pages and direct fetches are blocked (logged in `findings-log.md`). If Olexiy wants Reddit voices, he can share threads he knows.

## 4. The name

- **"PromptHub" is taken** by [prompthub.us](https://www.prompthub.us/), an active SaaS in exactly this space (prompt versioning + community library). LangSmith also calls its registry a "Prompt Hub". Using the name publicly invites confusion and possibly a trademark dispute.
- Candidates with no product of the same name found in a web search today: **Promptyard**, **Promptloft**, **Prompt Atelier**. Not checked: domains and trademark registries — do that in the roadmap task before anything public. The repo name can stay `prompt-hub` while it is private.

## 5. Recommendation: build

**Adopt** (PromptHub Pro, $9/mo annual) would cover storage, versions and sharing for Olexiy alone, and is the honest alternative if the goal were only "keep my prompts". It fails the brief on: no self-hosting / data ownership, private prompts tied to a subscription, comments and one-click rendered copy not evident, nothing for image/video prompts, and no portfolio value.

**Fork** — two realistic bases, both rejected:

- _prompts.chat_ (MIT, Next.js + Postgres, auth ready, 174k ★): a public library with no versioning, variables or private projects; we would rewrite the data model, which is the core of the product, and inherit a large codebase built for a different goal.
- _Langfuse_ (MIT core): its prompt management is a module of an observability platform (ClickHouse, tracing); stripping it down costs more than building, and it has no public/private model.

**Build** because:

1. The combination in the brief — GitHub-like public/private **projects** + per-prompt **versions** + **variables** with one-click rendered **copy** + **comments/meta** + **import** — does not exist in one product.
2. The ComfyUI/image-video use case (long structured shot lists, many variants, output images as evidence) is unserved; every versioned tool targets LLM app developers.
3. The core domain is small and well understood (projects, prompts, versions, variables); the hard parts are security and multi-tenancy, which Olexiy wants as portfolio material anyway.
4. Risk: the market is crowded with small tools that never took off (§3). Mitigation: build for Olexiy's real use first, judge by whether he uses it daily, keep v1 small.

**Ideas to borrow** (input for the feature catalogue, #3):

- Open WebUI: typed variables `{{priority | select:options=[…]}}`, version diff and "set as live", per-prompt access private / users / public.
- Langfuse: immutable versions + movable labels (`production`, `latest`), prompt references (compose one prompt from others), folders via path names.
- PromptHub: branches, stars and forks on public prompts.
- ComfyUI_PromptManager / galleries: attach output images to a version, ratings, "last used".
- prompts.chat: CC0/licence field on public prompts, MCP server and CLI access.

## Decision

**2026-10-23: build** — Olexiy's decision, recorded in [decisions.md](../decisions.md).
