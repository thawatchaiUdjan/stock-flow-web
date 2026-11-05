# 0015: CI: GitHub Actions

Status: Accepted
Date: 2026-11-05

## What it is for

`ci.yml` runs on pull requests and pushes to `main`, with `concurrency` + `cancel-in-progress` and the Bun cache. Job `check`: oxlint, `oxfmt --check`, typecheck, Vitest, Orval regenerate-and-diff, build. Job `e2e`: Playwright. Branch protection on `main` requires both.

## Why it was chosen

Two jobs let the fast feedback finish without waiting for a browser install. Both run on Node LTS beside Bun, because Vitest and Playwright do.

## What was not chosen and why

- One job: simpler, but `check` would wait on Playwright's browser install.
- Another CI host: the code is already on GitHub.
