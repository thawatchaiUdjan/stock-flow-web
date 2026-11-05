# 0004: API client: Orval, generated from a copy of the contract

Status: Accepted
Date: 2026-11-05

## What it is for

The API client is generated, never hand-written. `bun run api:sync` copies `stock-flow-api`'s `openapi.yaml` from `main` to `openapi/openapi.yaml`, and `bun run api:generate` runs Orval 8 over it into `src/api/generated/`: TanStack Query hooks, Zod 4 schemas and MSW handlers (one per HTTP status). `bun run api:check`, in CI, fails if regenerating changes what is committed.

The one hand-written piece is `src/api/fetcher.ts`, the mutator every generated call goes through.

## Why it was chosen

One generator gives hooks, validation and honest mocks from the same file, so they cannot drift from each other.

The mutator exists because Orval's defaults are unsafe here. Its `fetch` client resolves on any status, so Query would treat a 503 as a success. Its `forceSuccessResponse` option does throw, but a plain `Error` with an `info` field while still typing the error as `ErrorModel`, so `error.errors` would compile and be undefined, and that is the field forms map from (ADR 0005). The mutator throws an `ApiError` carrying the Problem Details, and exports `ErrorType` so the hooks are typed with what is really thrown. A non-JSON error body (an edge failure before the API answers) still rejects with its status.

Verified: Orval's handlers on MSW 3. The 200 and 503 handlers answer in Vitest through `msw/node`, and the 200 handler answers in Chromium through the service worker. They need `@faker-js/faker`, a dev dependency.

Orval's default mocks answer random strings, so `src/mocks/handlers.ts` pins what the real API sends.

## What was not chosen and why

- A hand-written client: drifts from the contract, and `AGENTS.md` forbids it.
- `openapi-typescript` + `openapi-fetch`: types only, with no hooks, Zod or MSW.
- Generating straight from the api's `main`: a contract change would turn this repo's CI red with no change here. A committed copy makes each refresh a reviewed diff.
- `forceSuccessResponse` without a mutator: see above.
