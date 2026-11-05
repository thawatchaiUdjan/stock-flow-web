# 0017: Contract: REST/JSON, OpenAPI 3.1

Status: Accepted
Date: 2026-11-05

## What it is for

The API is REST/JSON, described by OpenAPI 3.1 generated code-first by Huma. `stock-flow-api` commits the generated `openapi.yaml` at its root, and its CI fails if the file differs from the code. This repo keeps a copy and generates from it (ADR 0004). All three repos are public, so `api:sync` needs no token.

## Why it was chosen

A shared decision, restated here because this repo depends on it: the contract's owner cannot drift from its own file, and this repo cannot drift from its copy.

## What was not chosen and why

- Hand-written OpenAPI: drifts from the code.
- GraphQL, tRPC: tRPC needs a TypeScript server, and the server is Go.
