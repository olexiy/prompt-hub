# Runbook: environments, deploy, rollback, secrets

Two cloud environments, both on free plans (no recurring cost):

| Environment | Worker               | Supabase project (eu-central-1)               | Hyperdrive config                                         |
| ----------- | -------------------- | --------------------------------------------- | --------------------------------------------------------- |
| staging     | `prompt-hub-staging` | `prompt-hub-staging` (`wrzdtnlaenycimqouplj`) | `prompt-hub-staging` (`d85b37a1a2fa4afc930d607fe8b7f339`) |
| production  | `prompt-hub`         | `prompt-hub-prod` (`kwoxieodqxzkcoizbpfz`)    | `prompt-hub-prod` (`3957d985e9884411827cde3f350bcf79`)    |

Wrangler environments are in `apps/api/wrangler.jsonc` (`env.staging`, `env.production`). The top-level Worker `prompt-hub-local` is for local dev and tests only. **Always pass `--env`.**

Project refs and Hyperdrive ids are public identifiers and live in the repo. Supabase publishable keys are public by design but kept out of the repo (gitleaks flags them); they are GitHub environment variables passed with `--var`. Secrets:

| Secret                              | Where it lives                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Database passwords                  | Olexiy's machine: `~/.prompt-hub/secrets.env` (outside the repo); inside the Hyperdrive configs at Cloudflare |
| `DATABASE_URL` (migrations)         | GitHub environment secret, `staging` and `production`                                                         |
| `CLOUDFLARE_API_TOKEN`              | GitHub environment secret, `staging` and `production`                                                         |
| Supabase secret keys / service role | Not used by the Worker; only in the Supabase dashboard                                                        |

Workers subdomain: `ol-sakura.workers.dev` — staging is **https://prompt-hub-staging.ol-sakura.workers.dev** (deployed 2026-10-23, Data API off, sign-up off, site URL set). Production is **https://prompt-hub.ol-sakura.workers.dev** (first deploy 2026-10-23, Data API off, sign-up off, site URL and `/auth/callback` redirect set).

GitHub variables: `CLOUDFLARE_ACCOUNT_ID` at repository level (the preview job's `if` can only read repository variables); per environment `SUPABASE_PUBLISHABLE_KEY` (`supabase projects api-keys --project-ref <ref>`) and `APP_URL` (`https://prompt-hub-staging.<subdomain>.workers.dev`, `https://prompt-hub.<subdomain>.workers.dev`).

## One-time setup

1. **Supabase projects** (done 2026-10-23, Supabase CLI): `supabase projects create prompt-hub-<env> --org-id … --region eu-central-1`, DB password generated locally. Free plan allows two active projects; the older paused projects stay paused.
2. **Migrations** (done): `DATABASE_URL=<session pooler URL> corepack pnpm db:migrate`. Session pooler: `postgresql://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`.
3. **Hyperdrive** (done): `wrangler hyperdrive create prompt-hub-<env> --connection-string=<session pooler URL>`.
4. **Supabase hardening**: push only the declared keys from a minimal config (Data API off, sign-up off, email logins on):

   ```toml
   project_id = "prompt-hub-cloud"
   [api]
   enabled = false
   [auth]
   enabled = true
   enable_signup = false
   site_url = "<APP_URL>"
   additional_redirect_urls = ["<APP_URL>/auth/callback"]
   [auth.email]
   enable_signup = true
   ```

   `supabase config diff --workdir <dir> --project-ref <ref>` first, then `supabase config push --workdir <dir> --project-ref <ref>` and confirm each change. Also in the dashboard: disable the legacy JWT-based API keys (anon/service_role) — the Worker uses the publishable key and verifies ES256 tokens via JWKS.

5. **Cloudflare API token** (dashboard only, Olexiy): _My Profile → API Tokens → Create Token → Edit Cloudflare Workers_ template, restrict to this account; add _Hyperdrive: Edit_. Store it as the `CLOUDFLARE_API_TOKEN` secret in both GitHub environments; never paste it into chat or issues.
6. **GitHub environments** `staging` and `production` (Settings → Environments): secrets above; `production` with Olexiy as required reviewer.
7. **Owner account** in production: created by Olexiy in the Supabase dashboard (_Authentication → Users → Add user_), since sign-up is closed.

## Deploy

- **Preview per PR**: automatic (`deploy.yml`, job _Preview version_): `wrangler versions upload --env staging --preview-alias pr-<N>`; the URL is posted to the PR. Previews use the staging database and are never promoted.
- **Staging / production**: _Actions → Deploy → Run workflow_, pick the target. Production only after Olexiy's explicit go. Steps: migrations → web build → `wrangler deploy --env <target>` → smoke test (`/api/health`, CSP header on `/`).
- Manual fallback (same order):

  ```bash
  corepack pnpm --filter @prompt-hub/web build
  ```

  ```bash
  corepack pnpm --filter @prompt-hub/api exec wrangler deploy --env staging --var SUPABASE_PUBLISHABLE_KEY:<key>
  ```

## Rollback

Tested on staging 2026-10-23: `wrangler rollback <previous version id> --env staging` switched 100% of traffic back in seconds; `/api/health` stayed up.

Workers keep previous versions. List and roll back:

```bash
corepack pnpm --filter @prompt-hub/api exec wrangler deployments list --env production
```

```bash
corepack pnpm --filter @prompt-hub/api exec wrangler rollback --env production
```

`wrangler rollback <version-id>` targets a specific version. A rollback does not undo database migrations: migrations are written to be backward compatible with the previous Worker version (add columns, backfill, drop only in a later release).

## Smoke test with a throwaway user

`supabase projects api-keys --reveal --project-ref <ref>` gives the secret key (without `--reveal` it is masked and the admin API answers "Invalid API key"). New `sb_secret_` keys go only in the `apikey` header, not as `Authorization: Bearer`. Create a confirmed user via `POST /auth/v1/admin/users`, sign in through the Worker, call `/api/me`, sign out, delete the user. Never print the key.

## Rotate secrets

- **Database password**: Supabase dashboard → _Project Settings → Database → Reset password_; then `wrangler hyperdrive update <id> --connection-string=<new URL>`; update `DATABASE_URL` in the GitHub environment and `~/.prompt-hub/secrets.env`.
- **Cloudflare API token**: roll it in the dashboard, update the GitHub secret, revoke the old one.
- **Supabase JWT signing key**: _Project Settings → JWT Keys_ → rotate; the Worker picks up the new key from JWKS, existing sessions end at their next refresh.
