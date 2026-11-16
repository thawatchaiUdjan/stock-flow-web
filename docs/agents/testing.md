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
| Run the smoke suite (needs Postgres, see below) | `bun run smoke` |

The first slow run on a machine needs `bunx playwright install chromium`.

## The smoke suite: the web against the real api

The fast and slow layers both run against the contract's mocks, and `stock-flow-api`'s tests run the api alone. Nothing else proves that the two agree: field names, status codes, the session cookie through the `/api` proxy, the migrations. The smoke suite (`e2e-smoke/`, its own Playwright config) does: it drives the built app, without MSW, against a real `stock-flow-api` and Postgres.

- **What it covers:** the installation and stock/order happy path, followed by email setup/recovery: first Owner requests send no email, Admin/Staff creation separates provider acceptance/failure, a First-time code sets a password, recovery preserves sessions until reset, reset ends sessions across devices, links work once, and installed Owner recovery works. The existing stock path runs in order: the Owner sets a password from the Setup link and logs in, adds a Product, receives stock for it, creates an Order, completes it and sees the Sale on the Dashboard. Every other case stays in the mocked `e2e/` suite.
- **CI only.** It is the `smoke` job in `.github/workflows/integration.yml`, run manually and weekly. It checks out the API commit in `openapi/api-source.json`, builds the api (cached by its commit), migrates a Postgres service container, issues the Owner's Setup link and starts the api. Its first step fails, saying to run `bun run api:sync`, when `openapi/openapi.yaml` differs from the pinned API's contract. `bun run ci` does **not** run it, because it needs Postgres.
- **Locally, if you have a Postgres** (and `../stock-flow-api` or another checkout of it; paths below are from its root): migrate an empty database with `go tool goose -dir db/migrations postgres "$POSTGRES_URL" up`, print the Owner's Setup link token with `go run ./cmd/install -name "Smoke Owner" -email owner@smoke.example`, start the api with `go run ./cmd/api`, then from this repo:

  ```sh
  SMOKE_OWNER_EMAIL=owner@smoke.example SMOKE_SETUP_LINK_TOKEN=<the token> bun run smoke
  ```

  `API_PROXY_TARGET` (default `http://localhost:8080`) points the app at the api. The suite starts from a freshly migrated database: the token works once, and the Dashboard check expects no other Sale. To run again, reset the database and issue a new token.

## Overrides

- **This overrides `implement`'s "the full test suite once at the end".** Locally, "the full suite" means the whole fast layer. The slow layer runs only in CI, and **no agent waits for it**: open the pull request and move on. `e2e` is a required check on `main` (ADR 0015), so GitHub holds the merge until it passes. When the user reports a red pipeline, investigate it here under `docs/workflow.md`; no context coordinator is required.
- You still **write** slow tests, one per user journey the record names (below); you just don't wait for them. Write them so they pass first time on a clean environment: unique data, no ordering assumptions.
- **Until CI exists, nothing runs the slow layer.** In that case, run the end-to-end tests this change touched once before opening the pull request, and say in it that you did.

## Keep the fakes honest

A fast layer is only as good as its fakes. A fake more permissive than the real dependency hides exactly the defects a real one would catch (a missing uniqueness or concurrency guard, an ordering that only holds by accident).

- **The fakes are Orval's generated MSW handlers**, with responses pinned to what the real API can return: real empty lists, real paging, real error codes from the published list. Orval's defaults are random, so never leave one unpinned. A fake that never fails tests nothing.
- Nothing in these two layers runs against the real API (ADR 0011): the Orval diff guards the contract, and the smoke suite (above) is the one place the web meets the real api.

## Keep the slow layer cheap

- **Few end-to-end tests**, one per user journey the record names, not one per rule. Rules are covered in the fast layer.
- **Build and start the app once** per run, not once per test.
- **Unique data per test** (generated names, keys), so tests never collide on shared mock state.
- **Log in through the shared helper**, `logIn` in `e2e/support.ts`, never a copy of it: it waits until the app has left Log in, which is when the mock API has saved the session. A test that expects to stay on Log in (a wrong password) uses `attemptLogIn`, which does not wait.
- **Never `goto` right after an action that saves state** without first waiting for what proves it was saved (the URL changes, a notice appears). The mock API saves asynchronously, and a reload before that comes up with the old state.

## Running long tests as an agent

- Start a test run expected to exceed a minute in the background, and read its result when it finishes, rather than polling it in a loop.
- Set the command timeout above the slowest test file; a run killed by a timeout proves nothing and has to be repeated.
- At most two test runs at once on one machine: they finish sooner one after another than all together.

## Email integration fixture

The workflow's `SMOKE_MAIL_URL` points to `scripts/integration-mail.mjs` on the disposable runner. It captures actual API-rendered provider payloads without external delivery. Its `/messages`, `/fail` and `/resume` controls bind to loopback only and are never included in the application build. The fixture's TLS certificate is trusted by the API test process using `SSL_CERT_FILE`; certificate validation stays enabled. A runner-only hosts entry maps `api.brevo.com` to loopback. The workflow executes the API's existing `go test -count=1 -tags slow ./...` suite without editing API sources, covering expiry, replacement, attempt boundaries, shared request limits, credential invalidation and database concurrency. The browser journey waits out the real shared sixty-second cooldown.

Local `bun run smoke` now also needs this configured email fixture and `SMOKE_MAIL_URL`; use the integration workflow for the complete, reproducible environment. The earlier manual installer commands alone cover only installation/stock, not the complete email suite. Credentials in fixture mailboxes are disposable test data; never substitute production mail or publish inbox payloads.
