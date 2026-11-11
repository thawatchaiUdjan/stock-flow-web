# Prompt for the API repository

Run the following in a session rooted in `stock-flow-api`. This file is a handoff, not a claim that the API repository has already migrated.

```text
Make this API repository own its requirements and workflow independently of stock-flow-context.

The owner authorises migrating workflow ownership and preserving current product behaviour. Work only in this repository; do not edit web or context. Use a branch and prepare a reviewable change; do not merge without explicit authorisation.

Inspect this repository's instructions, skills and existing workflow first. Import the relevant confirmed requirements, glossary and business decisions from the existing context record once. Preserve rule IDs, source-commit provenance, unresolved questions and historical citations. Avoid collisions between business and technical ADR numbers. Context becomes historical reference, not a required checkout or approval service.

Enable the local workflow: /grill-with-docs, local requirements/decisions, record PR, /to-spec, /to-tickets, /implement, tests, code-review and implementation PR. Install the planning skills and dependencies through this repo's skill process. Update AGENTS.md, README, tracker/domain guidance, skill installer and PR templates consistently. Preserve existing product, security, testing and review rules. Keep API contract generation and publication owned here.

Web and API each handle their own work. The owner authorises necessary task-related issue requests and replies directly between web and API, without extra handoff approval. When a task needs the other side, send the request directly to that repo, link the issues, explain the behaviour and contract need, and let that repo own its plan and implementation. No context repo, middleman or coordinator. A request is not approval of new business rules. Block only dependent work; independent work can continue. Do not promise that web has adopted an API change until web confirms its pinned contract version.

Keep published contracts compatible or explicitly version breaking changes. Web adopts a specific API commit and tests integration against it; it does not track API main automatically. Notify web directly of relevant published contract changes under that same handoff authorisation. Unrelated external messages still need authorisation.

Document source provenance, forward migration, rollback, remaining external dependencies and any unresolved questions. Run this repo's required checks. Report what changed and what remains; never silently change product behaviour or sibling repositories.
```
