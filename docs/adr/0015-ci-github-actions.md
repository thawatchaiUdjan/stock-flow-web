# 0015: CI: GitHub Actions

Status: Proposed
Date: 2026-11-05

## What it is for

`ci.yml` runs on pull requests and pushes to `main`, with `concurrency` + `cancel-in-progress` and the Bun cache. Job `check`: oxlint, `oxfmt --check`, typecheck, Vitest, Orval regenerate-and-diff, build. Job `e2e`: Playwright. Branch protection on `main` is to require both.

## Why it was chosen

Two jobs let the fast feedback finish without waiting for a browser install. Both run on Node LTS beside Bun, because Vitest and Playwright do.

Proposed until branch protection is on, which needs both checks to have run once. Requiring `e2e` conflicts with `docs/agents/testing.md`, where a pull request "can be merged before its pipeline finishes": that is raised on ticket #1.

## What was not chosen and why

- One job: simpler, but `check` would wait on Playwright's browser install.
- Another CI host: the code is already on GitHub.
