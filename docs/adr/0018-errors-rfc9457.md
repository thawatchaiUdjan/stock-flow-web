# 0018: Errors: RFC 9457 Problem Details

Status: Accepted
Date: 2026-11-05

## What it is for

API errors are `application/problem+json` (Huma's default), with `errors[].location` naming the offending field (for example `body.quantity`). `src/api/fetcher.ts` turns them into `ApiError`.

## Why it was chosen

A shared decision, restated here because forms depend on it (ADR 0005).

`AGENTS.md` requires error messages to map from a published error-code list, with a CI check. Problem Details as decided carries no code beyond the HTTP status, so for now the list is the per-operation statuses in `openapi.yaml`. Neither the mapping nor its CI check exists yet: the `/` route shows one fixed message for any failure, and never the server's text. Whether domain errors get their own codes is an open question for `stock-flow-context` (`stock-flow-api` ADR 0014), and the mapping waits on it.

## What was not chosen and why

- A custom error envelope: Huma already speaks Problem Details.
