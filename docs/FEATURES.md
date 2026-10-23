# Feature catalogue and v1 scope

Issue #3. Sources: [brief.md](brief.md) (marked **B**), ideas from the [market scan](research/market-scan.md) (marked **M**), and what a multi-user public service needs (marked **S**).

**Priority for v1:** `must` (v1 is useless without it) · `should` (planned for v1, can slip) · `could` (only if cheap) · `won't` (not in v1, maybe later).
**Rec** = Claude's recommendation. **Decision** = Olexiy's call; empty until discussed.

## Shape of a real prompt
The first import material shapes the model. `olexiy/comfy-h3-studio/prompts/` holds one video prompt in several **length variants** (`len_6s` … `len_15s`, `prompt_5s`, `prompt_plain`), each 1.5–2 KB, with **named sections** that repeat across variants: shot list with timecodes, *appearance lock*, *background lock*, camera, soundscape, music, **negative prompt**, and **image references** (`<Picture 1>` is the first frame). So a prompt is not one string: it has sections, variants that differ by a parameter, reusable blocks and a separate negative part. The vault `prompts/` folder (7 notes: coding, writing, research, health) is the LLM-side counterpart: plain text prompts with some placeholders.

## A. Projects, prompts and versions

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| A1 | Projects: create, rename, describe, archive, delete | B | must | the top-level container in the brief | |
| A2 | Prompts inside a project: create, edit, delete, move between projects | B | must | core | |
| A3 | Every save of a prompt creates an immutable version with an optional message | B | must | the reason the product exists | |
| A4 | Version history: list, view any version, restore as new version | B | must | versioning is useless without it | |
| A5 | Diff between two versions (word-level, side by side) | M | must | long shot-list prompts change by a few words; without a diff history is unreadable | |
| A6 | Labels on versions (`live`, `best`, custom), movable | M (Langfuse) | should | "which version is the good one" without deleting others | |
| A7 | Variants: sibling prompts of one prompt (e.g. 6 s / 9 s / 15 s), each with its own history | M (PromptHub branches) + import material | should | exactly the comfy-h3-studio case; simpler than Git branches | |
| A8 | Git-style branches and merge for prompts | M (PromptHub) | won't | heavy UX for single-author prompts; A7 covers the need | |
| A9 | Structured prompt: named sections (positive, negative, camera, …) instead of one text field | import material | should | negative prompt and repeated sections are the ComfyUI reality; keeps diff and copy precise | |
| A10 | Reusable blocks: a block (e.g. "appearance lock") referenced from many prompts, versioned itself | M (Langfuse references) | could | strong for character consistency, but adds dependency/versioning complexity | |
| A11 | Folders / sub-projects inside a project | M | could | tags (E2) may be enough at v1 sizes | |
| A12 | Prompt types: text, chat (system/user messages), image/video | M | should | LLM vs ComfyUI prompts differ; type drives copy format | |
| A13 | Soft delete with trash, restore within 30 days | S | should | protects against the "lost good prompt" problem the product is for | |

## B. Variables, rendering and copy

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| B1 | Variables in text, `{{name}}` syntax, detected automatically | B | must | brief | |
| B2 | Fill-in form generated from the variables, then preview of the rendered prompt | B | must | brief | |
| B3 | One-click copy of the rendered prompt to the clipboard | B | must | brief | |
| B4 | Default values and descriptions per variable | M (Open WebUI) | must | without defaults every copy needs typing | |
| B5 | Typed variables: select (options), number, boolean, multiline text | M (Open WebUI) | should | e.g. `{{duration | select:6s,9s,15s}}`; cheap once B1–B4 exist | |
| B6 | Saved value sets ("presets") per prompt, e.g. "red-haired woman, bus stop" | S | should | repeated renders with the same values; removes retyping | |
| B7 | Copy only one section (e.g. negative) or copy as JSON | A9 | could | useful for ComfyUI nodes with separate inputs | |
| B8 | Unicode variable names and content (Cyrillic, Japanese) | M (Langfuse bugs) | must | Olexiy writes in RU/UA; Langfuse broke here | |
| B9 | Logic in templates (if/loops, Jinja-like) | M | won't | turns prompts into code; security and UX cost | |
| B10 | Variable values recorded with each copy (usage history) | M (ComfyUI_PromptManager) | could | nice "what did I use last time"; privacy considerations | |

## C. Collaboration and sharing

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| C1 | Project visibility: private / public (read-only for everyone, also without login) | B | must | brief, "like GitHub" | |
| C2 | Comments on a prompt (author, time, edit/delete own) | B | must | brief | |
| C3 | Comments tied to a specific version | B | should | "this version over-smooths the face" belongs to v7, not to the prompt | |
| C4 | Meta fields: free key–value pairs per prompt (model, sampler, seed, CFG, source link…) | B | must | brief | |
| C5 | Meta field templates per project (same fields on every prompt) | S | could | consistency for ComfyUI parameters | |
| C6 | Collaborators on a project with roles: owner / editor / viewer | S | should | the multi-user promise; needed before anyone else uses it | |
| C7 | Unlisted link (anyone with the link can read) | M | could | share one project without making it public | |
| C8 | Stars and fork of public projects/prompts into your own account | M (PromptHub) | could | community feature; v1 has no community yet | |
| C9 | Public profile page listing a user's public projects | S | could | follows from C1 | |
| C10 | Organisations / teams with billing | — | won't | non-goal in PROJECT_PLAN | |
| C11 | Result attachments: images/videos attached to a version as evidence | M (ComfyUI galleries) | should | ComfyUI users find prompts through outputs; needs object storage (cost, moderation) | |
| C12 | Licence field on public prompts (CC0, CC-BY, all rights reserved) | M (prompts.chat) | could | matters once things are public | |

## D. Import and export

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| D1 | Import a single prompt: paste or upload `.txt` / `.md` | B | must | brief | |
| D2 | Import a whole project: zip or folder of `.txt`/`.md` files (one file = one prompt) | B | must | brief; covers comfy-h3-studio and the vault folder | |
| D3 | Own project format (JSON/YAML with versions, variables, meta, comments) for export and re-import | S | must | lossless backup; export is also a GDPR right | |
| D4 | Export project as a zip of Markdown files | S | should | readable outside the app, e.g. into Obsidian | |
| D5 | Import from Markdown front matter (meta fields from YAML header) | S | could | vault notes have properties | |
| D6 | Import from a GitHub repo folder by URL | S | could | handy, but adds outbound fetching (SSRF care) | |
| D7 | Import from ComfyUI workflow JSON / PNG metadata (extract prompts) | M | could | strong ComfyUI hook; formats vary | |
| D8 | Import from other products (Langfuse, PromptHub, prompts.chat) | M | won't | no users to migrate yet | |

## E. Search and organisation

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| E1 | Full-text search over own prompts (title, text, meta), Cyrillic-aware | S | must | finding a prompt is half the value | |
| E2 | Tags on prompts, filter by tag | S | must | cheap, flexible organisation | |
| E3 | Sort/filter: recently edited, recently copied, by project, by type | S | should | daily navigation | |
| E4 | Favourites / pin | S | could | small | |
| E5 | Search public prompts of all users | S | could | only meaningful with public content | |
| E6 | Semantic search by intent ("prompt for slow camera pan") | M (HN voices) | won't | needs embeddings infra and cost; revisit after v1 | |

## F. Accounts and security

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| F1 | Sign-up / sign-in with email + password, email verification, password reset | B | must | brief | |
| F2 | Sign-in with GitHub and Google (OAuth/OIDC) | S | should | lower friction; provider choice in #4 | |
| F3 | Authorisation on every request: project/prompt access checked server-side per user and role | B | must | brief; the core security property of a multi-tenant app | |
| F4 | Two-factor authentication (TOTP) | S | should | public service; may come from the auth provider | |
| F5 | Rate limiting on auth and write endpoints, abuse protection on sign-up | S | must | internet-facing | |
| F6 | Account deletion with all data, data export | S | must | GDPR (Olexiy is in the EU) | |
| F7 | Audit log per project (who changed what) | S | could | versions already record author and time | |
| F8 | Moderation of public content: report button, admin can hide | S | should | required once C1 lets anyone publish | |
| F9 | Admin area (users, reports, stats) | S | could | minimal version via DB at first | |
| F10 | Security headers, CSP, input validation, OWASP ASVS level chosen in #4 | S | must | requirement, details in #4 | |

## G. Integrations

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| G1 | REST API with personal access tokens (read prompts, render with variables) | M | should | scripts and ComfyUI can fetch prompts; the UI uses the same API anyway | |
| G2 | MCP server (Claude, Cursor read and render prompts) | M (prompts.chat, promptify) | could | thin layer over G1; very useful for Olexiy's Claude work | |
| G3 | ComfyUI custom node: pick a prompt/version, render variables inside the workflow | M | could | strong differentiator; separate repo, after G1 | |
| G4 | CLI (`ph get project/prompt --var x=y`) | M | could | thin layer over G1 | |
| G5 | Browser extension inserting prompts into ChatGPT/Claude | M | won't | crowded space, separate product | |
| G6 | Run a prompt against a model, evaluations, tracing | M | won't | LLMOps territory, non-goal | |
| G7 | AI help: "improve this prompt", auto-tags | M | won't | paid API cost; revisit later | |

## H. Product basics

| ID | Feature | Src | Rec | Why | Decision |
|---|---|---|---|---|---|
| H1 | Responsive UI (works on phone for copy) | S | should | copy from phone into a mobile app | |
| H2 | Dark mode | S | could | cheap with a component library | |
| H3 | UI languages: English first, Russian/Ukrainian later | S | could | i18n setup is cheap early, translations later | |
| H4 | Keyboard shortcuts (search, copy) | S | could | power-user speed | |
| H5 | Legal pages: privacy policy, terms, imprint | S | must | required before going public in the EU | |
| H6 | Backups of the DB with tested restore | S | must | losing prompts is the failure the product exists to prevent | |

## Won't-have list for v1
Filled from the agreed decisions. Candidates: A8 Git branches, B9 template logic, C10 organisations/billing, D8 migration from other products, E6 semantic search, G5 browser extension, G6 running/evaluating prompts, G7 AI help.

## v1 scope
Summarised in [PROJECT_PLAN.md](PROJECT_PLAN.md) once the batches are agreed.
