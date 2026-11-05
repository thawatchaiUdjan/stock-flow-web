# 0015: CI: GitHub Actions

Status: Proposed
Date: 2026-11-05

## What it is for

`ci.yml` runs on pull requests and pushes to `main`, with `concurrency` + `cancel-in-progress` and the Bun cache. Job `check`: oxlint, `oxfmt --check`, typecheck, Vitest, Orval regenerate-and-diff, build. Job `e2e`: Playwright. Branch protection on `main` is to require both.

## Why it was chosen

Two jobs let the fast feedback finish without waiting for a browser install. Both run on Node LTS beside Bun, because Vitest and Playwright do.

Proposed until branch protection is on, which needs both checks to have run once. `e2e` is required on purpose: the owner chose a merge gate over `docs/agents/testing.md`'s earlier "can be merged before its pipeline finishes", and that file now says so. The job takes under a minute.

## What was not chosen and why

- One job: simpler, but `check` would wait on Playwright's browser install.
- Another CI host: the code is already on GitHub.
