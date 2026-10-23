# Testing

Pick the cheapest layer that proves the behaviour (DEV_PROCESS §5). Backend logic is written test-first.

| Layer           | Where                         | Runner                                 | Runs against                                                                         |
| --------------- | ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit            | `packages/core/src/*.test.ts` | Vitest 5                               | plain functions                                                                      |
| API integration | `apps/api/test/*.test.ts`     | Vitest 5 + `@cloudflare/vitest-plugin` | the real Worker in the Workers runtime (Miniflare), real `wrangler.jsonc`            |
| Database        | added in #20                  | Vitest                                 | a throwaway Postgres                                                                 |
| End-to-end      | `e2e/tests/*.spec.ts`         | Playwright 1.64                        | local Worker on port **8788** serving the built web app, desktop and phone viewports |

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

## Browsers

Playwright uses an installed browser instead of downloading its own: **Microsoft Edge** on Windows, **Google Chrome** on the GitHub runner (`E2E_CHANNEL=chrome` in CI). Set `E2E_CHANNEL` to override.

## Writing tests

- API tests call the Worker through `exports.default.fetch(...)` from `cloudflare:workers`; types come from the generated `apps/api/worker-configuration.d.ts` (`corepack pnpm --filter @prompt-hub/api types` after changing `wrangler.jsonc`).
- Every new endpoint gets an authorisation test proving another user gets 404 (from #22 on).
- e2e specs fail on any console error; keep that check in new specs.
- No mocks of our own internals; mock only at the boundary (external HTTP).
