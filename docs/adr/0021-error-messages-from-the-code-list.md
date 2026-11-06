# 0021: Error messages map from the contract's list of codes

Status: Accepted
Date: 2026-11-06

## What it is for

This supersedes the second paragraph of ADR 0018, which waited on `stock-flow-api` to settle whether domain errors get codes. They do (`stock-flow-api` ADR 0019): each carries a bare code in Problem Details' `type`, and the `enum` of `ErrorModel.type` in `openapi/openapi.yaml` is the published list. The rest of ADR 0018 stands.

`src/api/errors.ts` holds the one table from code to message, typed `satisfies Record<ErrorModelType, string>` against the type Orval generates from that `enum`. Screens read a message from that table, through `errorMessage` or `messageFor`, never the server's `detail`. An error with no `type`, or one this build doesn't know, gets the `about:blank` message.

## Why it was chosen

`AGENTS.md` asks CI to fail when a code the UI handles isn't in the list, or a listed code has no message. The type does both with no script: a missing key and an excess key each fail `bun run typecheck`, which CI runs, as soon as a contract refresh changes the `enum`.

## What was not chosen and why

- A test that parses `openapi.yaml`: a second reading of the list, for what the generated type already says.
- Showing the server's `detail`: the wording would belong to the api, and a change there would change the screen unreviewed.
