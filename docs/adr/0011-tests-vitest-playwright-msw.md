# 0011: Tests: Vitest and MSW, Playwright against mocks

Status: Accepted
Date: 2026-11-05

## What it is for

The fast layer is Vitest 5 + Testing Library + MSW, run by `bun run test`. The slow layer is Playwright, run in CI against the built app with MSW mocks and no backend. The Orval diff guards contract compatibility.

`vite build --mode e2e` builds to `dist-e2e/` with `e2e/public/` as its public directory, so the service worker exists only in that build. `src/main.tsx` starts MSW behind `import.meta.env.MODE`, which the production build drops; `dist/` was checked and holds no MSW or faker code.

## Why it was chosen

End-to-end tests with no backend need no database, no seeded data and no deployed API, so they cannot flake on one. MSW is shared by both layers, so one set of handlers serves them.

This changes `docs/agents/testing.md`'s template, where the slow layer ran against a live API: that file is updated. The trade-off is real: nothing automated now runs the app against the real API, so the contract diff has to carry that weight.

MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`. It is set to `error` in both layers, and an unmocked request was seen to fail a test.

## What was not chosen and why

- Playwright against a running API: slower and flakier, and needs a database in CI.
- Playwright's `page.route` for mocks: a second mocking system to keep honest.
- `bun test`: Bun's own runner, which isn't Vitest. Vitest and Playwright run on Node LTS.
