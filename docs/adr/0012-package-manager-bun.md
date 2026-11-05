# 0012: Package manager: Bun, with isolated installs

Status: Accepted
Date: 2026-11-05

## What it is for

Bun 1.4 runs installs and scripts, pinned by `packageManager` in `package.json`. Vite stays the dev server and bundler, and Vercel picks up `bun.lock`. Tests run with `bun run test`, never `bun test`. `bunfig.toml` sets `linker = "isolated"`.

## Why it was chosen

Fast installs and one tool for scripts.

The isolated linker is required, not a preference. Hoisted, `node_modules/ajv` is ajv 6, which eslint needs (a peer of the TanStack lint plugins, ADR 0010), and Orval's `ajv-draft-04` resolves it in place of the ajv 8 it needs, so Orval crashes on `Cannot find module 'ajv/dist/core'`. Isolated installs give each package only its own dependencies.

## What was not chosen and why

- npm, pnpm: both work; Bun is faster, and new tools are welcome here.
- Hoisted, with `ajv` 8 added as a root dependency to win the hoist: an unused dependency that only works by accident of ordering.
