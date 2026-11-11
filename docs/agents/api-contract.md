# API contract and integration

The API repository owns backend behaviour and publishes OpenAPI. This repository owns when it adopts a published version. No backend checkout is needed for frontend planning, generation, unit tests or mocked browser tests.

## Accepted contract

`openapi/api-source.json` records the API repository and exact commit. `openapi/openapi.yaml` is the contract adopted from that commit. `bun run api:sync` fetches that pinned contract, never a moving branch. Orval generates `src/api/generated/`; never edit the generated client by hand.

To adopt a backend change:

1. Read the linked API issue/PR and published contract. Resolve any disagreement with local requirements directly with the API owner.
2. Update `openapi/api-source.json` to the full API commit SHA (40 hexadecimal characters). Do not use `main` or a floating tag.
3. Run `bun run api:sync`, then `bun run api:generate`.
4. Update affected frontend code and honest mocks. Run the fast checks, `bun run api:check`, and open a PR containing the source manifest, contract and generated client.
5. Run the separate API integration workflow on the branch. Its smoke suite uses the same API commit and proves the happy path against the actual backend and Postgres.

The generation check proves the client matches the committed contract; it does not prove backend compatibility. The smoke test supplies that additional evidence. Ordinary PR checks use only the local accepted contract. API `main` moving cannot silently change the integration target.

## Independent development

`bun run dev:mock` runs Vite's existing `e2e` mode with the shared MSW handlers. MSW intercepts API traffic in the browser; no backend runs. Start at `/set-password#mock-setup-link-token`, set a password and log in as `nok@example.com`. This is a fresh mock shop with no Products or Orders. Vite development assets bypass MSW; unhandled API requests still report errors. State survives reloads in the same tab; clear session storage or open a new tab to reset it.

`bun run dev` uses a real service at `API_PROXY_TARGET` (default `http://localhost:8080`). It can point at any compatible API deployment. Production still uses the rewrite in `vercel.json`. Mocks never ship in the production build.

Proposed contracts belong in planning docs or throwaway prototypes until published by the API. Mocks for the accepted client must stay within its real response, paging and error shapes.

## Integration workflow

`.github/workflows/integration.yml` runs manually and weekly. Select the frontend branch when running it manually; it reads that branch's API pin. It retains the real backend/database smoke journey without making backend checkout part of every frontend PR. Its outcome must be reported when adopting a new API version; a scheduled failure becomes a local investigation, not a context-coordinator task.
