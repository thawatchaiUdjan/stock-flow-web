# 0010: Lint and format: oxlint and oxfmt

Status: Accepted
Date: 2026-11-05

## What it is for

oxlint, type-aware through `oxlint-tsgolint` (kept on the same TypeScript version), with the `react` and `jsx-a11y` plugins and `react/rules-of-hooks` enabled explicitly, plus `@tanstack/eslint-plugin-query` and `@tanstack/eslint-plugin-router` through `jsPlugins`. oxfmt (beta) formats, with Tailwind class sorting and import sorting.

## Why it was chosen

Both are fast, and oxlint's type-aware mode runs on the same native TypeScript as the rest of the stack. oxfmt's output matches Prettier's, so falling back is cheap.

Verified with planted violations, each reported as an error: `rules-of-hooks`, `no-floating-promises` (type-aware), `jsx-a11y/alt-text`, `@tanstack/query/exhaustive-deps`, `@tanstack/query/stable-query-client`, and `@tanstack/router/create-route-property-order`, so the TanStack Router plugin runs under `jsPlugins`. oxfmt's Tailwind sort orders v4 utilities and the theme's tokens (`@container`, `size-4`, `bg-background`, `hover:bg-primary/80`), inside `cn()` too, reading `src/index.css`.

Markdown is excluded from oxfmt: it would reformat hand-written docs, and `docs/design.md` changes only in its own pull request. The TanStack plugins declare `eslint` as a peer, so ESLint is installed but never run; that peer is what ADR 0012's linker setting works around.

## What was not chosen and why

- Biome: left out by the stack decision; oxlint's type-aware linting and `jsPlugins` carry the TanStack rules.
- ESLint + Prettier: the slower baseline this replaces.
