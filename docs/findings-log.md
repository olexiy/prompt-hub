# Findings log

Observations that are not decisions: measurements, surprises, things that did not work. Newest first, dated.

## 2026-10-23 — Reddit is not reachable for research
`WebSearch` with `site:reddit.com` returns no Reddit pages, and `WebFetch` refuses reddit.com (including the `.json` API). User voices for research come from HN (the Algolia API `hn.algolia.com/api/v1/search` works well, also for comments: `tags=comment,story_<id>`) and GitHub issues (`api.github.com/search/issues`). For Reddit, ask Olexiy for thread links.

## 2026-10-23 — Vendor numbers disagree across aggregators
For Langfuse, Agenta and PromptLayer, third-party pricing sites gave different prices and feature splits than the vendors' own pages. The market scan uses vendor pages and the GitHub API only; aggregator numbers are marked as such.
