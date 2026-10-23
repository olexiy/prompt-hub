# Security policy

## Reporting a vulnerability
Please **do not open a public issue**. Report privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting is enabled). Include steps to reproduce and the impact you expect.

You will get an answer within 7 days. Fixes for confirmed issues are prioritised over feature work.

## Supported versions
The project is in early development; only the latest `main` and the current production deployment are supported.

## What we do
- Target standard: OWASP ASVS 5.0 Level 2 — see [docs/research/architecture.md](docs/research/architecture.md) §6–7.
- Automated: CodeQL, secret scanning with push protection, Dependabot alerts and security updates, gitleaks, OSV-Scanner and Semgrep in CI, daily scheduled scans.
- Supply chain: npm packages only after a release-age delay, install scripts blocked by default, GitHub Actions pinned to commit SHAs.
