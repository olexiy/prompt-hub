# Security

Target: **OWASP ASVS 5.0, Level 2** (ADR in `docs/decisions.md`, controls in `docs/research/architecture.md` §7). This file is the checklist: one row per area with its status and where it lives. Update it in the same PR as any change that adds, weakens or completes a control.

Status: **Done** (in place and tested) · **Partial** · **Planned** (issue named) · **N/A** (feature does not exist; revisit when it does).

## Baseline mechanics (#23)

| Mechanism        | Where                                                          | Notes                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headers, API     | `apps/api/src/security/headers.ts`                             | `default-src 'none'` CSP, HSTS, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, Permissions-Policy, COOP/CORP, `Cache-Control: no-store`. Set after the handler, so errors get them too. |
| Headers, web app | `apps/web/public/_headers` (copied to `dist/` by Vite)         | Strict CSP: `script-src 'self'`, `style-src 'self'`, no `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'`; same companion headers; immutable caching for hashed assets.                              |
| Rate limiting    | `apps/api/src/security/rate-limit.ts`, `wrangler.jsonc`        | Workers Rate Limiting binding, keyed by `cf-connecting-ip`. `AUTH_LIMITER` 10/min on sign-in, reset, recovery session, password change. `WRITE_LIMITER` 60/min on every non-GET. 429 + `Retry-After: 60`.  |
| Body limits      | `apps/api/src/security/validate.ts`                            | 256 KiB per request body, 413 above.                                                                                                                                                                       |
| Validation       | `parseJson(c, schema, message)` in `validate.ts`               | Every body goes through a Zod schema; failure is a 400 with the route's own message, never Zod details.                                                                                                    |
| Errors           | `apps/api/src/security/errors.ts`                              | `onError`: clients get `{ error, requestId }` only; 500 details go to the log under the same id (Cloudflare ray id when present).                                                                          |
| Logs             | `apps/api/src/security/log.ts`                                 | One JSON line per event; keys like token/password/cookie/email are masked, emails and JWTs are scrubbed from strings.                                                                                      |
| CSRF             | `apps/api/src/auth/middleware.ts` (`sameOrigin`)               | Non-GET must carry our `Origin` and `application/json`; cookies are `SameSite=Lax`.                                                                                                                        |
| Tests            | `apps/api/test/security.test.ts`, `e2e/tests/security.spec.ts` | Headers on success/404/401/400 and on HTML; 429 after the limit; 400/413 bodies; no internals in 500s; app runs under the CSP with no console errors.                                                      |

## ASVS 5.0 L2 by chapter

| Chapter                                 | Status  | How / what is left                                                                                                                                                                                 |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 Encoding and Sanitization            | Partial | React escapes output; no `dangerouslySetInnerHTML`; SQL only through Drizzle parameters. Prompt bodies rendered as text — verify in #25.                                                           |
| V2 Validation and Business Logic        | Partial | Zod on every body, size limits (#23). Query/path params and slug patterns come with the first resource routes (#25); plan limits in v3.                                                            |
| V3 Web Frontend Security                | Done    | Strict CSP, `frame-ancestors 'none'`, nosniff, HSTS, COOP, Referrer-Policy (#23). Cookies `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` (#22). HSTS preload after #21.                           |
| V4 API and Web Service                  | Partial | JSON only, same-origin + content-type check, 415/403, `no-store`. Per-endpoint authz tests start in #25.                                                                                           |
| V5 File Handling                        | N/A     | No uploads yet; R2 attachments arrive in v1 (Phase 3).                                                                                                                                             |
| V6 Authentication                       | Partial | Supabase Auth, no passwords stored by us, sign-up closed, generic error messages, no account enumeration on reset, rate limit on credential endpoints. Turnstile + invites: Phase 2; TOTP MFA: v2. |
| V7 Session Management                   | Done    | Tokens only in HttpOnly cookies, server-side refresh, sign-out revokes at Supabase and clears cookies (#22).                                                                                       |
| V8 Authorization                        | Partial | `requireUser` on protected routes; RLS on all tables (#20). Owner/visibility scoping + "other user → 404" tests per endpoint from #25.                                                             |
| V9 Self-contained Tokens                | Done    | ES256 JWTs verified against Supabase JWKS: issuer, audience, expiry; `alg: none` and foreign keys rejected (tests in #22).                                                                         |
| V10 OAuth and OIDC                      | N/A     | No social login yet.                                                                                                                                                                               |
| V11 Cryptography                        | Done    | No custom crypto; `jose` for JWT verification, platform TLS.                                                                                                                                       |
| V12 Secure Communication                | Partial | Cloudflare TLS at the edge, HSTS; Hyperdrive → Supabase over TLS. Verify TLS settings and min version on the production zone in #21.                                                               |
| V13 Configuration                       | Partial | Secrets in `.dev.vars` (gitignored) and Wrangler/GitHub secrets; gitleaks + push protection; release-age gate, SHA-pinned actions. Production secrets set up in #21.                               |
| V14 Data Protection                     | Partial | EU regions, `no-store` on API, no personal data in logs (#23). Export/deletion in v1, backups to R2 in #21.                                                                                        |
| V15 Secure Coding and Architecture      | Partial | Few dependencies by policy, Dependabot, daily OSV scan, CodeQL. Dependency review per PR.                                                                                                          |
| V16 Security Logging and Error Handling | Partial | Central error handler, structured redacted logs with request ids (#23). Audit events for sign-in success/failure and permission denials: Phase 2.                                                  |
| V17 WebRTC                              | N/A     | Not used.                                                                                                                                                                                          |

## Known gaps and decisions

- **Rate limits are per IP and per Cloudflare location** (the binding is eventually consistent). Per-account protection against credential stuffing comes from Supabase Auth's own limits and Turnstile (Phase 2).
- **`cf-connecting-ip` is trusted** because Cloudflare overwrites it at the edge; locally and in tests it is missing (key `unknown`) or set by the test.
- **Trusted Types** (`require-trusted-types-for 'script'`) are not enabled yet; check Primer compatibility before turning them on.
- **`/security-review`** runs before every production deploy that touches auth, authorisation or input handling.
