# Testing

Pick the cheapest layer that proves the behaviour (DEV_PROCESS §5). Backend logic is written test-first.

| Layer           | Where                         | Runner                                 | Runs against                                                                                                                     |
| --------------- | ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit            | `packages/core/src/*.test.ts` | Vitest 5                               | plain functions                                                                                                                  |
| API integration | `apps/api/test/*.test.ts`     | Vitest 5 + `@cloudflare/vitest-plugin` | the real Worker in the Workers runtime (Miniflare), real `wrangler.jsonc`                                                        |
| Database        | `packages/db/test/*.test.ts`  | Vitest 5                               | a throwaway database per file on local Supabase Postgres (`TEST_DATABASE_URL`) or the CI Postgres 17 service; skipped when unset |
| End-to-end      | `e2e/tests/*.spec.ts`         | Playwright 1.64                        | local Worker on port **8788** serving the built web app, desktop and phone viewports                                             |

## Commands

```bash
corepack pnpm test
```

```bash
corepack pnpm build
```

```bash
corepack pnpm e2e
```

`e2e` needs a fresh `build` (the Worker serves `apps/web/dist`). It starts `wrangler dev` on 8788 itself, so it never touches `pnpm dev` on 8787.

## Visual regression and performance budget (#37)

Both run **locally only**, against the local stack; nothing touches Cloudflare or Supabase cloud.

```bash
corepack pnpm visual
```

`e2e/visual/visual.spec.ts` screenshots dashboard, project, prompt, history and settings in light and dark, desktop and phone, with a fixed user (`visual@example.test`, handle `visual`) and fixed data; dates are masked. Baselines live in `e2e/visual/__screenshots__/<platform>/<project>/` (Edge on Windows today) and allow 20 differing pixels. Like `e2e`, it needs a fresh `build`.

```bash
corepack pnpm visual:update
```

Rewrites the baselines after an intended UI change; commit them with the change and look at the new pictures in the diff. A different OS or browser renders fonts differently, so a new machine first runs `visual:update` into its own platform folder.

```bash
corepack pnpm perf
```

`e2e/perf/perf.ts` (plain Node, no k6) seeds a throwaway user with 60 prompts on `pnpm dev` (8787; `PERF_URL` for another local port, any non-local URL is refused), then measures sign-in, project list, project root, prompt, history and search with 5 requests in parallel and prints p50/p95/max. It exits with 1 when a p95 is over its budget (in the script: about 4x the values measured on 2026-10-25, e.g. 200 ms for reads).

## Browsers

Playwright uses an installed browser instead of downloading its own: **Microsoft Edge** on Windows, **Google Chrome** on the GitHub runner (`E2E_CHANNEL=chrome` in CI). Set `E2E_CHANNEL` to override.

## Writing tests

- API tests call the Worker through `exports.default.fetch(...)` from `cloudflare:workers`; types come from the generated `apps/api/worker-configuration.d.ts` (`corepack pnpm --filter @prompt-hub/api types` after changing `wrangler.jsonc`).
- Locally the API suite runs with 2 workers (`apps/api/vitest.config.ts`): every test signs users in through Supabase Auth (bcrypt), which is slow on a busy machine. The per-test timeout is 15 s everywhere (5 s was hit on CI, #38).
- Every new endpoint gets an authorisation test proving another user gets 404 (from #22 on).
- e2e specs fail on any console error; keep that check in new specs.
- e2e specs that change account state create their own user (`e2e/tests/users.ts` `createUser`), and every page calls `ownClientIp(page)` so the per-IP sign-in limit never trips during a run.
- Requests without `cf-connecting-ip` share one rate-limit key; API tests that send many writes give each request its own fake IP (see `apps/api/test/security.test.ts`).
- No mocks of our own internals; mock only at the boundary (external HTTP).
- Accessibility (#38): `e2e/tests/a11y.spec.ts` runs axe-core (`@axe-core/playwright`, WCAG 2.1 A/AA) over sign-in, dashboard, project, prompt and search in light and dark, desktop and phone. A new main screen gets a step there; a violation fails with "rule: element — help" lines.

## Local Supabase is part of the test setup (#22)

API, DB and e2e tests run against the local Supabase stack (Postgres 17 + Auth), in CI as well:

```bash
corepack pnpm db:start
```

```bash
corepack pnpm db:migrate
```

`apps/api/.dev.vars` (gitignored) holds `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from `corepack pnpm exec supabase status -o env`; `DATABASE_URL` / `TEST_DATABASE_URL` = `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Test users are created through the Auth admin API in the global setups (sign-up is closed) and deleted afterwards.
