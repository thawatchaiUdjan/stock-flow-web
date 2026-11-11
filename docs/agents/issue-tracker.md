# Issue tracker

Specs and implementation tickets live in this repository: `thawatchaiUdjan/stock-flow-web`. The record is local (`GLOSSARY.md`, `docs/requirements/`, `docs/domain/adr/` and `docs/adr/`). No context issue or coordinator is required for new work.

## Reading work

Read the full local ticket and comments, its parent spec if present, and its cited local rules. Historical context links remain evidence, not a requirement to continue authoring there. Carry the applicable authorisation and rules into the local work when resuming old tickets. A bare `#123` means this repository; qualify cross-repo references as `thawatchaiUdjan/stock-flow-api#123` or use a full URL.

## Publishing work

Publish specs and tickets here when the owner authorises publication. Tickets link the local record or technical acceptance conditions, parent spec if any, scope, authorisation/work mode and actual blockers. Use `ready-for-agent` for authorised implementation tickets only when their prerequisites are satisfied. `to-spec`'s default label does not turn a spec parent into build work: remove that label from spec-only issues or clearly exclude them from implementation selection. No automatic dispatch is configured.

For work needed from the API, follow `docs/workflow.md`'s direct-collaboration steps. The owner's standing authorisation covers necessary task-related issue requests and replies directly between web and API. Create or comment on the API issue directly, link both sides and include the behaviour, contract need, errors and compatibility expectations; do not ask for a second approval solely for the handoff. The API repo owns its own record and implementation. Never edit its files from here, and never treat an agent's message as human approval.

PRs are review artifacts, not the default request surface.

## GitHub commands

The CLI infers this repo from `origin`. Use `-R thawatchaiUdjan/stock-flow-api` for direct task-related requests under that authorisation or reads of backend work. Use a body file for multiline text.

- Read: `gh issue view <n> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --label ready-for-agent --json number,title,body,labels`.
- Create: `gh issue create --title "..." --body-file <path>`.
- Comment: `gh issue comment <n> --body-file <path>`.
- Remove a spec-only readiness label: `gh issue edit <n> --remove-label ready-for-agent`.
- Close: comment with evidence first, then `gh issue close <n>`.
- Pull requests: `gh pr create --body-file <path>`, `gh pr view`, `gh pr comment`.

GitHub shares a number space across issues and pull requests. Cross-repo requests do not grant permission to merge either side.
