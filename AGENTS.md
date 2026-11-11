<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `bunx --no-install --package @tanstack/intent intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx --no-install --package @tanstack/intent intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# AGENTS.md

## What this repo is

The frontend for stock-flow. This repository owns its requirements, vocabulary, decisions, specs, tickets and workflow. `stock-flow-context` is historical reference only; no sibling checkout or coordinator is required.

| Repo | Role | Remote (`owner/repo`) |
| --- | --- | --- |
| `stock-flow-web` | This repo: frontend and its local record | `thawatchaiUdjan/stock-flow-web` |
| `stock-flow-api` | Independent backend; publisher of the API contract | `thawatchaiUdjan/stock-flow-api` |

Never edit a sibling repository from here. The owner's standing authorisation covers necessary task-related issue requests and replies directly between web and API; no extra handoff approval is required. Coordinate through linked issues. The receiving repository owns its work. See `docs/workflow.md` and `docs/agents/api-contract.md`.

## Stack and commands

Project goal: a practice project for frontend development. Here that means: pick the best current tool, new ones welcome; job-market share is not a criterion.

`/implement` runs typechecking and tests (which ones: `docs/agents/testing.md`) with these commands; never guess others. All of them run from the repo root, in bash and in PowerShell.

| | |
| --- | --- |
| Framework / build tool | React 19 + TypeScript 7 (strict) + Vite 8, a single-page app (ADR 0001); TanStack Router, file-based (ADR 0002) |
| UI component library | Tailwind CSS v4 + shadcn/ui on Radix (ADR 0006) |
| Install dependencies | `bun install` |
| Run locally | `bun run dev:mock` needs no backend; `bun run dev` proxies `/api` to `API_PROXY_TARGET` |
| Typecheck / build | `bun run typecheck`; `bun run build` |
| Run the fast layer | `bun run test`, never `bun test` (ADR 0012) |
| Run one end-to-end test by name | `bun run e2e -g "<name>"` (once per machine: `bunx playwright install chromium`) |
| Run everything (CI) | `bun run ci` |
| Smoke suite against the real api (CI only; needs Postgres, `docs/agents/testing.md`) | `bun run smoke` |
| Lint / format | `bun run lint`; `bun run format` fixes, `bun run format:check` only checks |
| Regenerate the API client | `bun run api:sync` fetches the commit in `openapi/api-source.json`, `bun run api:generate` regenerates; commit both (`bun run api:check` is CI's diff) |

UI language: English only; i18n is a later feature (ADR 0009). Coding standards: `CODING_STANDARDS.md`. Technical decisions: `docs/adr/`.

## Teaching

In an interactive session, explain each hard technical term as it comes up: its name, what it does, why it is needed. "explain PR #n" walks through the terms and reasons in that pull request.

## Where the rules come from

- Business rules live in `docs/requirements/`, vocabulary in `GLOSSARY.md`, and business decisions in `docs/domain/adr/`. Technical decisions stay in `docs/adr/`.
- Read `docs/agents/domain.md` before writing domain docs. `/grill-with-docs` writes settled behaviour to local requirements as well as terms and decisions; its skills' default ADR path is overridden for business decisions.
- Cite recorded rules as `// <module> R3` or `// domain ADR 0007`. Existing `context ADR NNNN` citations resolve to imported `docs/domain/adr/NNNN-*.md`; preserve their meaning.
- If the record, ticket, code or accepted contract disagree, surface the conflict before changing the affected behaviour. Unknown rules belong under the local module's Open questions until resolved by the owner or within explicit task delegation.
- This migration is authorised by the owner's request to make each repo independent. Imported workflow decisions are historical where superseded by ADR 0023 and `docs/workflow.md`; product rules are unchanged.

## Planning and tickets

Follow `docs/session-guide.md` for the hybrid session workflow. At stage boundaries, tell the owner the next action, whether to stay, open a new session or return to an existing one, and the recommended model and effort. When handing off, provide a filled, copyable prompt with durable task links and branch state. Continue authorised Autopilot stages without requiring a separate command for each; do not claim settings changed unless tooling confirms it.

The review policy in `docs/session-guide.md` overrides upstream review-skill defaults, including after skill reinstallations: explicit reviewer settings, focused context, coverage of uncommitted implementation changes, and a usable manual fallback.

Start here with `/grill-with-docs <idea>`, confirm local requirements, then `/to-spec`, `/to-tickets` and `/implement <ticket>`. Full steps and work modes: `docs/workflow.md`.

Specs and tickets live in this repository. A build ticket links the local confirmed record (or technical acceptance conditions), its spec if any, the owner's authorisation and actual blockers. A request from another repository is information, not human approval.

Coordinate directly with the API repository when a feature needs backend work. Block only dependent integration. Proposed mocks are exploratory until the API publishes the contract; do not silently add proposed operations to the accepted client. Never edit the backend from this session.

## The API contract

`stock-flow-api` publishes the contract; this repo explicitly adopts a pinned version. See `docs/agents/api-contract.md`.

- **The API client is generated from the published contract, never written by hand.** CI must regenerate it and fail if the result differs from what is committed. The contract is `openapi/openapi.yaml`, the snapshot adopted from the API commit in `openapi/api-source.json`, and Orval generates the client from it into `src/api/generated/` (ADR 0004).
- **Error messages map from the API's published error-code list.** CI must fail when a code the UI handles is not in that list, or a listed code has no message.
- **Client-side validation repeats a recorded rule and cites it; it is never stricter than the server.** A client stricter than its server hides the server's defects.
- **Mocks and fixtures never return more than the real API would**: real empty responses, real paging, real errors. A generous mock makes the screen pass and production fail.

## Tests

- **What runs where: `docs/agents/testing.md`.** Locally, the fast layer only; the slow layer runs in CI, and nobody waits for it. Until CI exists, run the touched end-to-end tests once before opening the pull request, where they can run.
- Test-first, with the `tdd` skill, at the seam the ticket names (usually the screen or component as a user drives it).
- **Derive tests from the record's rules**, not from the implementation: every rule gets a test that fails if the rule is removed.
- Assert what was sent to the API, not only what came back, wherever a wrong request could still produce a believable screen.
- After green, break the rule on purpose once and watch a test fail. If none fails, a case is missing.

## Design

For every new UI, UI fix, or feature that changes UI, use this order:

1. Load the `shadcn` skill. Check the repository's existing components and the shadcn/ui catalog before writing custom UI, including charts.
2. Reuse an existing shadcn/ui component when it meets the requirements.
3. If it does not fit directly, customize or compose shadcn/ui components to meet the requirements and `docs/design.md`, preserving accessibility.
4. Use another library or a custom implementation only when shadcn/ui cannot reasonably meet the requirements through customization or composition. Explain the specific limitation and the chosen alternative in the pull request.

Every screen follows the design direction in `docs/design.md`: its colors, type, layout and voice. Two skills, each with its own job; neither chooses a new direction while a ticket is being built:

- **`ui-ux-pro-max`**: UX rules and the stack's UI guidelines while building every screen, and its pre-delivery checklist before the pull request. In "plan the design", it drafts the direction's tokens (colors, type, density).
  - Run its script from this repo: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`. The `${CLAUDE_PLUGIN_ROOT}` path in its `SKILL.md` is empty outside a plugin.
  - Never use `--persist`: the direction lives in `docs/design.md` only.
  - From `--design-system`, take the tokens, not the page pattern: that part is landing-page shaped (hero, CTA) even for a back-office query.
- **`frontend-design`**: the words on every screen (labels, buttons, errors, empty states), and marketing pages. In "plan the design", it reviews the draft against generic defaults and writes the voice.

- **Until `docs/design.md` is filled, no screen is built**: the next step is "plan the design" (`ui-ux-pro-max` drafts it, `frontend-design` reviews it, the requirements owner approves its pull request).
- **From Figma:** `docs/design.md` is written from the exports in `docs/design/` (how to make them, and what each kind of change means: `docs/design/README.md`). Token values are copied as text, from the variables export or from the values written down or screenshotted from Figma's panels; never estimated from a frame's pixels. `ui-ux-pro-max`'s findings on them (contrast, say) are proposals for the requirements owner; they never change a value that came from Figma.
- A ticket's `Design:` line names its frames; each frame's image is the target for that screen. Where an image and `docs/design.md` disagree, or an image shows behaviour the record doesn't state, ask on the ticket.
- A screen the direction doesn't cover is a question on the ticket, not a new direction.
- Changing the direction is its own pull request, decided by the requirements owner; never a side effect of a ticket.

## Prototypes

`prototype` builds throwaway UI variations or logic demos; before `docs/design.md` exists, it is how candidate directions are compared. They are never merged to `main`: commit the prototype to a throwaway branch, record the verdict on the ticket, and carry only the validated decision into real code.

## Working a ticket

Work locally on a branch from `main`, or in a fresh worktree when explicitly requested. `/implement` uses the local ticket and record; no context dispatch is required.

A worker inherits the ticket's scope and authorisation. Record questions on the local ticket; resolve them directly with the owner or the linked API issue, within messaging authorisation. Do not start a coordinator or edit another repository. If a required answer is unavailable, explain the blocked portion and continue only independent authorised work.

Open a pull request filling the template. Never merge unless the owner explicitly authorises it. Historical context tickets remain evidence; new specs and tickets are local.

## Commits & pull requests

- Commits, pull requests and ticket comments are written in English, whatever language the session itself uses.
- Branch from `main`; merge through a pull request (a merge request on GitLab).
- Conventional commits, each referencing its ticket (`Refs #12`). `code-review` finds the spec through that reference; without it, the spec half of the review is skipped.
- Fill every section of the pull request template (`.github/pull_request_template.md`, or `.gitlab/merge_request_templates/Default.md`), including when you create the request from the CLI with an explicit body.

## Definition of done

- The fast layer, the typecheck and the linter pass, run in this session; never claim green without a run. End-to-end tests are CI's, and nobody waits for them; until CI exists, the touched ones ran once where they can (`docs/agents/testing.md`).
- Every rule the ticket cites has a test that fails without it.
- The generated client matches the current contract.
- `ui-ux-pro-max`'s pre-delivery checklist passes for every screen it changes.
- Every screen it changes follows `docs/design.md`.
- `code-review` has run on the branch, and its findings are fixed or listed in the pull request.

## Agent skills

### Stack skills

These APIs are newer than the agents' training (ADR 0014).

- **`shadcn`**: when adding or composing a shadcn/ui component. Run its commands as `bunx shadcn`, not `npx shadcn@latest`. Its theme commands (`apply`, presets) are off limits: the direction lives in `docs/design.md`.
- **TanStack Intent** (the *Skill Loading* block in this file): before working on routing or tables. `intent hooks` is left out on purpose.

### Issue tracker

Issues and specs in this repo on GitHub; the record lives here too. See `docs/agents/issue-tracker.md`.

### Domain docs

The glossary is `GLOSSARY.md`; requirements are in `docs/requirements/`; business ADRs are in `docs/domain/adr/`; technical ADRs are in `docs/adr/`. See `docs/agents/domain.md`.
