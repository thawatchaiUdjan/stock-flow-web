# stock-flow-web

The frontend for stock-flow. This repository owns its requirements, glossary, decisions, specs, tickets and implementation workflow. Start work here; no context checkout or central coordinator is required.

## Project goal

A practice project for frontend development. Choose tools for the work and learning value; job-market share is not a criterion.

## Run locally

```sh
bun install
bun run dev:mock
```

Mock development needs no backend. Open `/set-password#mock-setup-link-token`, set a password and log in as `nok@example.com`. The mock starts with an empty shop and persists state across reloads in the same tab. Clear session storage or open a new tab to reset it. The command reuses the existing `e2e` mode and shared MSW handlers; production builds exclude mocks.

For a real API, copy `.env.example` to `.env`, set `API_PROXY_TARGET` to a compatible service and run `bun run dev`. No backend source checkout is required. In a real install, the API's installer prints a token; open `<web origin>/set-password#<token>` (technical ADR 0022).

## Work from idea to code

Start with `/grill-with-docs <idea>` in this repository. Settle the local record, open its PR, then use `/to-spec`, `/to-tickets` and `/implement <ticket>`. Test-first development, design guidance, code review and implementation PRs remain part of the workflow.

Steps, work modes and direct API collaboration: [workflow](docs/workflow.md).

| Record | Location |
| --- | --- |
| Vocabulary | [GLOSSARY.md](GLOSSARY.md) |
| Behaviour and stable rule IDs | [requirements](docs/requirements/README.md) |
| Business decisions | `docs/domain/adr/` |
| Technical decisions | `docs/adr/` |
| Design direction | [design](docs/design.md) |
| Specs and implementation tickets | Issues in this repository |

`stock-flow-context` is historical reference. Existing rules were imported once with their IDs, unresolved questions and source provenance preserved; [domain provenance](docs/domain/README.md) explains old citations. Future frontend decisions are made here.

## API boundary

`stock-flow-api` independently owns backend work and publishes OpenAPI. Web adopts an exact API commit in `openapi/api-source.json`, keeps its contract in `openapi/openapi.yaml`, and generates the client with Orval.

```sh
bun run api:sync
bun run api:generate
bun run api:check
```

For a contract update, change the manifest to a reviewed API commit first. Regular frontend checks use the committed contract and mocks. A separate manual/weekly integration workflow runs the real API and Postgres against that pin. [Contract and integration guidance](docs/agents/api-contract.md) describes what each check proves.

If either repo needs work from the other, send an authorised request directly through linked issues. The receiving repo owns its requirements, planning and implementation; only genuinely dependent work waits. No context coordinator sits between them. [API migration handoff](docs/agents/api-workflow-handoff.md) contains the prompt for adopting this workflow in the API repo; this change does not modify that repo.

## Checks

Run `bun run test`, `bun run typecheck`, `bun run lint` and `bun run format:check` locally. `bun run build` builds production. CI also runs the browser suite and generated-client check. Exact testing policy: [testing](docs/agents/testing.md). `bun test` is not the project's test runner.

## Agent skills

Skills live in `.agents/skills/`, with `.claude/skills/` links and provenance in `skills-lock.json`. Run `./scripts/install-skills.sh` to refresh this repository only; review the lockfile and skill diffs before committing.

| Skill | Purpose |
| --- | --- |
| `grill-with-docs`, `grilling`, `domain-modeling` | Define local requirements, terms and significant decisions |
| `to-spec`, `to-tickets` | Publish local specs and small implementation tickets |
| `implement`, `tdd`, `code-review` | Build, verify and review authorised work |
| `codebase-design`, `diagnosing-bugs`, `prototype` | Module design, diagnosis and throwaway exploration |
| `shadcn`, `ui-ux-pro-max`, `frontend-design` | Existing UI components, UX checks and screen wording |
| `setup-matt-pocock-skills` | User-invoked tracker configuration; preserve local ownership rules |
| TanStack Intent | Guidance shipped with the installed TanStack packages; loading policy in `AGENTS.md` |

The migration adopts the five planning skills from the existing local context installation without changing their upstream versions or lock entries. The installer includes them for future refreshes.

Never hand-edit installed skill files: refreshes overwrite them. Repository overrides, including the business ADR directory and requirements output, belong in `AGENTS.md` and `docs/agents/`.
