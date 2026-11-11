# Workflow

This repository owns frontend requirements, vocabulary, decisions, specs, tickets and implementation. Start sessions here; neither sibling checkout is required. `stock-flow-context` is historical reference, not an approval or dispatch service. The API repository owns backend work independently.

## Choose the work mode

Before a new task, ask the owner to select Autopilot or Approval workflow unless the request already selects one. Keep that choice for the task and its continuations. Read-only questions need no selection. An explicit instruction to perform a concrete, agreed change authorises that change; it does not authorise unrelated work or merging.

In Autopilot, take recommended answers within the selected scope and record them. In Approval workflow, wait for the owner's answers and approvals. Neither mode grants permission to edit another repository. Merge only when explicitly authorised, after required reviews and green checks.

## From idea to implementation

| Step | Command or request | Result |
| --- | --- | --- |
| Define | `/grill-with-docs <idea>` | Read the local glossary, requirements and relevant decisions. Interview the owner, update `docs/requirements/`, and capture resolved terms and significant decisions locally. |
| Confirm | "open the record PR" | Review the requirements change here. Mark settled modules Confirmed in that PR; its merge confirms the record. Keep unknowns under Open questions. |
| Specify | `/to-spec` | Agree the test boundary, then publish a spec issue in this repository linking the local record. |
| Slice | `/to-tickets` | Propose small, independently verifiable frontend slices. Publish approved tickets here, linking their spec, authorisation and genuine blockers. |
| Build | `/implement <ticket>` | Work on a branch from `main`; use `tdd`, the design skills for UI changes, and the checks in `docs/agents/testing.md`. |
| Review | `code-review` | Review against the branch's starting point, local spec and coding standards. Fix findings or explain them in the implementation PR. |
| Finish | "open the implementation PR" | Fill the PR template. The owner reviews and merges unless merging was explicitly delegated. Close the local ticket when its acceptance conditions are met. |

For an already authorised technical change or bug fix, use its local ticket or written acceptance conditions directly; do not invent a business requirement or repeat the full interview.

`grill-with-docs` invokes `grilling` and `domain-modeling`; it does not itself define requirement-file output. This repository additionally requires settled behaviour in `docs/requirements/<module>.md`. Business decisions go in `docs/domain/adr/`, overriding the skill's default ADR directory. Technical decisions stay in `docs/adr/`.

Specs are plans, not implementation tickets. Do not dispatch or implement the spec parent merely because `to-spec` applies `ready-for-agent`; only authorised implementation tickets with satisfied blockers are ready to build. Small work can use one ticket without a separate parent spec.

## Direct collaboration with the API repository

Each repository plans and implements its own work. No middleman or central coordinator is required. The owner explicitly authorised necessary task-related issue requests and replies directly between web and API on 2026-11-11. No additional handoff approval is required. This does not authorise unrelated messages, edits in the other repo, or its product decisions.

1. Record the need in the originating repo's ticket: user-visible behaviour, relevant rules, proposed request/response shape, errors and compatibility requirements.
2. Create the necessary request directly in the other repository and link both issues under that standing handoff authorisation. Do not treat a request as approval of its proposed business rules.
3. The receiving repository owns clarification, its local requirements, ticket breakdown, implementation and review. It replies directly on the linked issues when the contract or implementation is available, without routing through context or another agent. A receiving agent's note does not grant human authorisation.
4. Block only the work that needs the missing capability. Frontend design and exploratory mocks can proceed separately, clearly marked proposed. Do not add proposed operations to the accepted contract or generated client, or claim production integration is done, until the API publishes them.
5. After the API publishes the capability, adopt a specific commit as described in `docs/agents/api-contract.md`, regenerate the client, and verify the frontend against it. Report the adopted version directly to the API issue under the same handoff authorisation.

Keep the origin of shared rules in each local requirement change. A frontend decision never changes backend guarantees by itself. If local requirements and the accepted API contract disagree, record the gap and resolve it directly with the API owner before integrating the dependent change.

## Existing work and migration

Historical context issues remain evidence; do not move, close or rewrite them automatically. For an existing ticket, carry the applicable rules and authorisation into a local issue or PR before continuing. Future work starts here. Skill updates run only this repository's installer.

The migration, source commits and rollback path are in [independent repository workflow](adr/0023-independent-repository-workflow.md). The API repo has not been changed by this migration; [its handoff prompt](agents/api-workflow-handoff.md) requests the equivalent change there.
