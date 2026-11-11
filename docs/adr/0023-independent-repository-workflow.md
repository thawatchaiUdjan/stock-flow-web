# 0023: Independent repository workflow and explicit API adoption

Status: Accepted
Date: 2026-11-11

## What it is for

The requirements owner requested that web and API each own their work, including `/grill-with-docs`, without a context repository or middleman. This repository now owns its glossary, requirements, business decisions, specs, tickets and implementation workflow. The API repo is separately owned and is not modified here.

The baseline record was imported from context commit `4c81bd45ff27cca31bd911e5e429b46c273265d2`. Preserve rule IDs and historical citations; `context ADR NNNN` now resolves to `docs/domain/adr/NNNN-*.md`. Business and technical decision numbers have separate directories. Product behaviour and unresolved security questions are unchanged.

This supersedes the central record ownership and moving-`main` contract adoption portions of technical ADRs 0004 and 0017; the shared CI smoke scheduling portion of ADR 0015; and the context-coordinator portions of imported domain ADRs 0005 and 0008. Per-task work modes are retained. The owner may explicitly authorise a concrete change; that does not authorise unrelated work, unrelated external messages or merging. The owner separately authorises necessary task-related issue requests and replies directly between web and API, without extra handoff approval. No central dispatch or coordination is required.

`openapi/api-source.json` pins an exact API commit. `api:sync` fetches that commit; ordinary frontend checks use the accepted local contract and mocks. The existing real-API smoke journey moves to a separate manual/weekly integration workflow using the same pin. New `dev:mock` reuses the existing `e2e` mode. In Vite development only, MSW bypasses same-origin non-API assets so lazy modules and hot updates do not emit unhandled-request errors; API requests retain strict reporting. Production behaviour and mock exclusion remain unchanged (ADR 0011).

## Why it was chosen

Planning should happen beside the code it changes. Direct, authorised requests through linked web/API issues replace coordinator dispatch. The receiving repo owns its clarification, record and implementation. Only work dependent on an unpublished capability waits; proposed mocks remain exploratory until the API publishes a contract.

An explicit API version prevents backend `main` from breaking unrelated frontend PRs. Retaining a real integration check provides evidence mocks cannot provide, at the cost of running it separately and explicitly during contract adoption.

## What was not chosen and why

- Keep context as a required record service: preserves the workflow dependency the owner asked to remove.
- Install interview skills without moving ownership rules: leaves contradictory instructions and no local authoritative requirements.
- Renumber imported business decisions into technical ADRs: breaks historical citations.
- Follow API `main` in each PR: unrelated backend changes can fail frontend checks.
- Remove API generation or real integration tests: weakens compatibility evidence.
- Change API files from this session: violates repository ownership; a handoff prompt requests that migration separately.

## Verification and rollback

Acceptance: local interviews and tickets need no sibling checkout; all product rule IDs and meaning survive; direct collaboration is documented; contract sync and integration use the same immutable API pin; local mocked development and required frontend checks work; no sibling repository changes.

The forward path is import, update local policy and planning skills, pin the accepted contract, split integration scheduling, then verify. No source repository or historical issue is deleted. To roll back, revert this migration's changes together on a new branch and restore the previous CI workflow and installer; do not delete the imported record if later local decisions depend on it. In that case, reconcile those decisions explicitly before restoring central ownership.
