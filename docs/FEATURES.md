# Feature catalogue and versions

Issue #3. Built in a brainstorm with Olexiy on 2026-10-23 from [brief.md](brief.md), the [market scan](research/market-scan.md) and his dictated ideas. Numbers are stable IDs used in issues and discussion; gaps are removed items (see the end).

## Product shape (agreed)

- **Project → optional folders → prompts → versions.** Prompts are fully independent of each other; no branches, no variants, no shared blocks in early versions. Variants are separate prompts in a folder, a duplicate, or a variable.
- **A new version is created by a button** ("New version"); a plain save edits the current version. History is visible **only to the author**.
- **Deleting is final** for everything (versions, prompts, folders, projects). No trash. Deleting a project asks to type its name, like GitHub.
- **Public projects** show only the latest version of each prompt. Visitors can comment and star. A fork copies only the latest versions, never the history.
- **Registration is invite-only** for now (Olexiy and friends). Open sign-up is a later decision.
- **Monetisation is designed in from the start** (plan and limits in the data model) but built late. Free limits: 25 projects, 250 prompts in total. Own AI key (BYOK) on Free and Pro; our AI on Pro through OpenRouter with a configurable monthly budget per user.
- **No integrations** (API, MCP, CLI, ComfyUI node, browser extension): the integration is copy & paste.
- **Built for later scale without building it now:** i18n-ready UI, tenant/plan-aware data model, IDs and URLs that survive renames.

## Feature list

### Projects, prompts, versions

1. Projects: create, rename, archive, delete
2. Prompts inside a project
3. "New version" button; the old version stays in the history
4. Version history (author only), restore an old version as the newest
5. Diff between two versions
6. Labels on versions (live, best, custom)
7. Prompt sections (positive, negative, camera, …)
8. Block prompt: a prompt assembled from a fixed set of sub-prompts _(later; replaces shared blocks)_
9. Folders inside a project, optional
10. Prompt types: text / chat / image-video
11. Delete any version (garbage versions)
12. GitHub-like URLs: `/{user}/{project}/{folder}/{prompt}`
13. Duplicate a prompt
14. Autosave of the current edit
15. Final delete everywhere; project deletion confirmed by typing its name

### Variables and copy

14. `{{variables}}` substituted into the prompt
15. Fill-in form and preview
16. "Copy" assembles the prompt with variables and puts the final text on the clipboard
17. Default values and descriptions for variables
18. Typed variables (select, number, …)
19. Saved value sets
20. Copy a single section (e.g. only negative)
21. Unicode everywhere (Cyrillic, German umlauts)
22. Copy history with the used values
23. Warning on copy when variables are unfilled

### Public projects and sharing

24. Project visibility private / public, switchable
25. Comments: own notes on a prompt; visitors comment on public prompts
26. Comments on a specific version (author only)
27. Optional meta fields: description, note, custom fields
28. Unlisted link (readable by anyone with the link)
29. Stars and fork (fork = latest versions only)
30. Public profile
31. Result images and videos attached to a version
32. Licence field on public prompts _(very low)_
33. Report button on public content; admin hides
34. Copy counter on public prompts
35. Email notifications (comments, reports)

### Templates

87. Prompt page templates per task (video shot list, SD/Flux image, LLM system prompt, coding agent; own templates) — sets sections, meta fields and starting text
88. Templates per model (Flux, SDXL, MiniMax H3, Kling, GPT, Claude, …) with the model's preferred structure and output format on copy (plain text, JSON, XML tags)
89. Starter projects and examples for new users

### Import, export and extractors

36. Import a single prompt (.txt, .md)
37. Import a project from a zip
38. Export a project as a zip: latest versions; variables filled if set, otherwise `{{…}}` placeholders. A copy with history only through a fork.
39. Export as Markdown (Obsidian)
40. Meta fields from Markdown front matter
41. **Comfy Extractor**: drop a ComfyUI PNG or video → prompt (positive/negative) into the prompt, full workflow description (nodes, settings, checkpoint, LoRAs with weights, VAE, seed, sampler, steps, CFG) into a meta field
42. Extractor for A1111 / Forge / InvokeAI images _(low)_
43. Workflow viewer: stored ComfyUI graph shown read-only, JSON downloadable
44. LoRA info from `.safetensors` metadata (trigger words, training tags)
45. Import prompts from a ChatGPT / Claude chat export

### Search and tags

44. Full-text search over own prompts
45. Tags on projects and prompts
46. Search and filter by tag across the whole hub
47. Sort and filters (recently edited, recently copied, type)
48. Favourites
49. Search across public prompts of all users
50. Semantic search by intent

### Accounts and security

50. Email + password, verification, reset
51. Sign-in with GitHub and Google
52. Authorisation checked on every request
53. Two-factor authentication
54. Rate limiting
55. Account deletion and data export (GDPR)
56. Audit log _(low)_
57. Admin area (users, invites, reports)
58. Security headers, CSP, OWASP level (chosen in #4)
59. Invite-only registration (invite links/codes)

### AI tools

66a. Translate a prompt into good English
66c. Own AI key (BYOK, Free and Pro) or our AI (Pro, via OpenRouter, configurable budget per user) 91. Turn a selected phrase into a variable 90. Split pasted text into template sections automatically 92. Compare two different prompts 93. Generate length variants (6 s / 15 s from 9 s) 94. Prompt from an image 97. AI screenwriter / copywriter: rough idea → per-second storyboard 98. Prompt optimiser and analyst: tokens, cost per model, context share, warnings (free, no AI); shortening, model fit and an optimised new version (AI, Pro) 101. Access to our AI tools' system prompts and customising them (Pro)

### Monetisation

75. Plans Free and Pro (Team maybe later)
76. Free limits: 25 projects, 250 prompts in total
77. Payments and subscription _(only if the product is ever launched)_
78. Organisations and team billing _(later)_

### Basics

67. Responsive UI (copy from the phone)
68. Light and dark theme
69. UI in English, Russian, German
70. Keyboard shortcuts
71. Legal pages (privacy, imprint, terms)
72. Backups with a tested restore

## Versions (proposal)

Each version ends in something Olexiy uses daily; later versions can be dropped without breaking earlier ones.

### MVP — "my prompts, online, safely"

Invite-only, deployed, Olexiy as the first real user; replaces text files and notes.
1, 2, 3, 4, 5, 11, 73, 78, 79, 102 · 14, 15, 16, 17, 21, 81 · 24 (private + read-only public view of latest versions), 27 · 36, 37, 38 · 44, 45, 74, 46 · 50, 52, 59, 103 · 67, 68, 69, 72.
Data model already carries: plan/limits per user, comments and stars tables can come later without migration pain, i18n keys.

### v1 — "ComfyUI workbench"

34 result images/videos · 86 Comfy Extractor · 9 sections · 87 task templates · 6 labels · 18 typed variables · 19 value sets · 20 copy a section · 82 autosave · 47 favourites · 70 shortcuts · 25 own notes · 39, 40 Markdown export/front matter · 54 rate limiting · 55 account deletion/export.

### v2 — "Public and friends"

25 visitor comments · 31 stars and fork · 32 public profile · 48 public search · 30 unlisted link · 57 reports · 58 admin area · 84 notifications · 83 copy counter · 53 2FA · 51 GitHub/Google sign-in · 89 workflow viewer · 99 LoRA info.

### v3 — "AI and Pro"

75, 76 plans and limits enforced · 66c BYOK / our AI via OpenRouter · 66a translate · 98 optimiser and analyst · 96 model templates · 91 make variable · 90 split into sections · 92 compare prompts · 100 chat import · 85 starter projects · 10 block prompts · 71 legal pages (needed before open registration).

### v4 — "AI studio"

97 AI screenwriter · 93 variants · 94 prompt from image · 101 custom system prompts · 49 semantic search · 77 payments (only on a real launch) · 33 teams.

### Backlog (low, no version)

23 copy history · 26 version comments · 35 licence · 56 audit log · 88 A1111/Forge extractor.

## Removed

7 variants (folders, duplicate or a variable instead) · 8 branches · 13 trash (deletes are final) · 22 template logic · 28 meta-field templates (covered by 87) · 29 collaborators · 41 import from GitHub · 42 extraction inside import (became tool 86) · 43 migration from other products · 60 REST API · 61 MCP server · 62 ComfyUI node · 63 CLI · 64 browser extension · 65 running prompts / evals · 66b, 80, 95 (merged into 98).

## Open, decided later

- Product name ("PromptHub" taken) — separate issue.
- Monthly hosting budget — #4.
- Payments, VAT, merchant of record — only if the product is ever launched.
