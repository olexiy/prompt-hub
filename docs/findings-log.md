# Findings log

Observations that are not decisions: measurements, surprises, things that did not work. Newest first, dated.

## 2026-10-23 — Skeleton toolchain notes (#17)

- **TypeScript 7.0 is too new for typescript-eslint** (8.72 wants `>=4.8.4 <6.1.0`); pinned `typescript@~6.0` (6.0.3).
- **pnpm 12.15.0 was 2 days old**, so the 3-day release-age gate would refuse it; pinned 12.14.0.
- **pnpm blocks dependency build scripts** (`strictDepBuilds`): `esbuild` and `workerd` postinstalls only verify binaries that already arrive as optional dependencies — denied, wrangler and Vite work. `pnpm` (pinned as a root devDependency so nested `pnpm` calls work without a global install) needs its install script to link the binary — allowed.
- **Primer React 38**: `ThemeProvider` from `@primer/react` is deprecated, use `@primer/react/next`; theme CSS variables apply inside the provider's element, so `BaseStyles` paints the page background (otherwise dark mode shows light text on the browser's white body).
- Wrangler sends anonymous telemetry by default; disabled with `send_metrics: false`.

## 2026-10-23 — Reddit is not reachable for research

`WebSearch` with `site:reddit.com` returns no Reddit pages, and `WebFetch` refuses reddit.com (including the `.json` API). User voices for research come from HN (the Algolia API `hn.algolia.com/api/v1/search` works well, also for comments: `tags=comment,story_<id>`) and GitHub issues (`api.github.com/search/issues`). For Reddit, ask Olexiy for thread links.

## 2026-10-23 — Vendor numbers disagree across aggregators

For Langfuse, Agenta and PromptLayer, third-party pricing sites gave different prices and feature splits than the vendors' own pages. The market scan uses vendor pages and the GitHub API only; aggregator numbers are marked as such.
