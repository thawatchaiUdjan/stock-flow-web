# Testing: what runs where

Tests come in two layers, and they run in different places, because waiting on slow tests is where agents lose the most time.

| Layer | What it touches | Speed | Runs locally | Runs in CI |
| --- | --- | --- | --- | --- |
| **Fast** | Components, state and logic, with MSW handlers generated from the contract | seconds for the whole layer | **all of it**, as often as you like | all of it |
| **Slow** | A real browser against the built app, with the same MSW handlers and no backend (ADR 0011) | seconds to minutes per test | **no** (see below) | all of it, every pipeline; nobody waits for it |

| | Command |
| --- | --- |
| Run the fast layer | `bun run test` |
| Run one slow test by name | `bun run e2e -g "<name>"` |
| Run everything (what CI runs) | `bun run ci` |

The first slow run on a machine needs `bunx playwright install chromium`.

## Overrides

- **This overrides `implement`'s "the full test suite once at the end".** Locally, "the full suite" means the whole fast layer. The slow layer runs only in CI, and **nobody waits for it**: a pull request can be merged before its pipeline finishes. When the user reports a red pipeline, the fix comes back as work (`stock-flow-context`'s `docs/workflow.md`).
- You still **write** slow tests, one per user journey the record names (below); you just don't wait for them. Write them so they pass first time on a clean environment: unique data, no ordering assumptions.
- **Until CI exists, nothing runs the slow layer.** In that case, run the end-to-end tests this change touched once before opening the pull request, and say in it that you did.

## Keep the fakes honest

A fast layer is only as good as its fakes. A fake more permissive than the real dependency hides exactly the defects a real one would catch (a missing uniqueness or concurrency guard, an ordering that only holds by accident).

- **The fakes are Orval's generated MSW handlers**, with responses pinned to what the real API can return: real empty lists, real paging, real error codes from the published list. Orval's defaults are random, so never leave one unpinned. A fake that never fails tests nothing.
- Nothing automated runs against the real API (ADR 0011): the Orval diff guards the contract.

## Keep the slow layer cheap

- **Few end-to-end tests**, one per user journey the record names, not one per rule. Rules are covered in the fast layer.
- **Build and start the app once** per run, not once per test.
- **Unique data per test** (generated names, keys), so tests never collide on shared mock state.

## Running long tests as an agent

- Start a test run expected to exceed a minute in the background, and read its result when it finishes, rather than polling it in a loop.
- Set the command timeout above the slowest test file; a run killed by a timeout proves nothing and has to be repeated.
- At most two test runs at once on one machine: they finish sooner one after another than all together.
