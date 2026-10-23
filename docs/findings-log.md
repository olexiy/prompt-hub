# Findings log

Observations that are not decisions: measurements, surprises, things that did not work. Newest first, dated.

## 2026-10-23 — First cloud environment (#21)

- Supabase CLI `projects create` works non-interactively with `--org-id --region --db-password`; new projects sign JWTs with ES256 (JWKS), so the Worker's verification works unchanged.
- `supabase config push` only pushes keys the config declares, so a minimal throwaway config is a safe way to change single settings; `config diff` previews exactly what changes. Right after a push, `diff` can briefly still show the old value.
- `supabase projects api-keys` masks secret keys unless `--reveal`; the masked value gives "Invalid API key". `sb_secret_` keys work in the `apikey` header only.
- gitleaks `generic-api-key` flags Supabase publishable keys; they now come from GitHub variables via `wrangler deploy --var`.
- Staging smoke (sign-in → `/api/me` through Hyperdrive → sign-out) passed on the first deploy; one leftover `app_user` row from the deleted smoke user remains in staging.

## 2026-10-23 — Security baseline notes (#23)

- **Primer React 38 runs under a strict CSP** (`style-src 'self'`, no `unsafe-inline`): no violations on the sign-in and reset screens. React `style` props are applied through the CSSOM, which `style-src` does not block; only the inline `<style>` in `index.html` had to move to a CSS file.
- **The Rate Limiting binding works locally**: Miniflare implements it, so the 429 test runs in the Workers Vitest pool and under `wrangler dev`. All requests without `cf-connecting-ip` share one key, so API tests set a random IP per request.
- **`_headers` in `apps/web/public`** is copied to `dist/` by Vite and applied by `wrangler dev` to the HTML and the SPA fallback, not to `/api/*` (the Worker sets those).

## 2026-10-23 — CI and push protection checked (#18)

- First CI run green in about 1 minute wall time; CodeQL default setup picked up `javascript-typescript` on the first TypeScript PR.
- Push protection test: a commit with a fake `sk_live_…` key on a throwaway branch was rejected (`GH013 … Push cannot contain secrets`); the branch never reached GitHub.

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
