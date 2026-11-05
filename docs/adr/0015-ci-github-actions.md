# 0015: CI: GitHub Actions

Status: Accepted
Date: 2026-11-05

## What it is for

`ci.yml` runs on pull requests and pushes to `main`, with `concurrency` + `cancel-in-progress` and the Bun cache. Job `check`: oxlint, `oxfmt --check`, typecheck, Vitest, Orval regenerate-and-diff, build. Job `e2e`: Playwright. A ruleset on `main` requires both, requires a pull request, and blocks force pushes and deletion.

## Why it was chosen

Two jobs let the fast feedback finish without waiting for a browser install. Both run on Node LTS beside Bun, because Vitest and Playwright do.

`e2e` is required on purpose: the owner chose a merge gate over `docs/agents/testing.md`'s earlier "can be merged before its pipeline finishes", and that file now says so. The job takes under a minute. The ruleset asks for no approvals: GitHub doesn't let an author approve their own pull request, and the owner works alone.

## What was not chosen and why

- One job: simpler, but `check` would wait on Playwright's browser install.
- Another CI host: the code is already on GitHub.
