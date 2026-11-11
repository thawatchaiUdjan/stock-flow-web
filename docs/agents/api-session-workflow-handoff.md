# Handoff: adopt the session workflow in the API repository

Open a new session rooted in `stock-flow-api`. Select **GPT-6.1 Sol / medium** and paste the prompt below. This is a documentation and skill-workflow task, not a request to change API behaviour. The web session has not edited the API repository.

The prompt is self-contained. The optional web references are local working-tree files as of 2026-11-11, not a claim that these changes have been committed, published or merged.

```text
Autopilot: adopt a practical session and reviewer-settings guide in this API
repository. I authorise this workflow/documentation change. Work only here;
do not edit stock-flow-web or stock-flow-context. Stop before merging.

Read this repository's AGENTS.md, workflow, installed skills, skill maintenance
or installer process, testing policy and PR template first. Follow its local
skill-loading rules. Preserve existing business, security, API contract,
publication and verification rules. Do not migrate requirements ownership,
change runtime code or contracts, install worker infrastructure, or introduce
a required coordinator as part of this task.

Optional read-only examples in the sibling web checkout:
C:/ProjectsDev/projects/stock-flow/stock-flow-web/docs/session-guide.md
C:/ProjectsDev/projects/stock-flow/stock-flow-web/.agents/skills/code-review/SKILL.md
C:/ProjectsDev/projects/stock-flow/stock-flow-web/docs/workflow.md
If these files are unavailable, use the acceptance conditions below; do not
require another checkout or block adoption solely on these examples.

Acceptance conditions:
1. Add a discoverable docs/session-guide.md and link it from local AGENTS.md
   and workflow guidance. Adapt examples, test commands and terms to the API
   repository; do not copy frontend-specific design, Bun or generated-client rules.
2. Keep requirements, /to-spec and /to-tickets together for a feature. Stay in
   the same session for small fixes, relevant short discussions, and a ticket's
   tests, review fixes and PR creation. Consider a fresh implementation session
   after long planning or for an independent substantial ticket only when a
   compact handoff can replace irrelevant history. A new session is optional.
3. Record important chat decisions before handing off. Explain that changing
   model/effort and opening a new session are separate choices; use host settings
   changes where supported. Do not claim to change active settings without evidence.
4. Starting recommendations: GPT-6.1 Sol / medium for planning and normal feature
   implementation; GPT-6.1 Terra / medium for small clear fixes; Sol / high for
   demonstrated difficult diagnosis, considering GPT-6 Astra / high if needed.
   Optional GPT-6 Luna / low for an already separate routine formatting task.
   Recheck actual availability; explain substitutions. No guaranteed savings.
5. Make review automatic after implementation and required checks, before PR
   completion. Preserve the local Standards and Spec axes. Explicitly request
   model gpt-6.1-sol and reasoning_effort medium for each reviewer unless the
   owner overrides them. For Codex spawn_agent use fork_turns none so settings
   can be overridden without inheriting the whole implementation conversation.
   Use equivalent supported controls in other hosts.
6. Pass focused context: repository instructions/path, task, pinned comparison
   base and reviewed commit, diff command, commit list, standards or spec sources.
   Let reviewers inspect relevant code/dependencies; do not copy the whole chat
   or the implementer's conclusions. Reviewers are read-only. Keep concise
   per-axis reports. Skip Spec only when no spec/acceptance source exists.
7. Ensure pre-commit review includes in-scope staged, unstaged and untracked new
   implementation files, not only base...HEAD. Identify the exact reviewed state,
   exclude unrelated dirty files and refresh affected review after changes.
8. If explicit reviewer settings are unsupported, report it and supply a filled
   handoff for a fresh Sol/medium review session. If subagents remain unavailable
   there, perform the two axes as separate passes and disclose reduced isolation;
   do not loop through the same handoff. Never silently inherit settings.
9. After fixes, revisit affected hunks and rules with the relevant reviewer.
   Avoid full repeated reviews unless scope changes. Report requested settings
   and whether effective settings are confirmed by tooling. Escalate only with
   a specific reason; do not spawn agents solely to format a short PR body.
10. At each stage boundary the agent supplies Next action, Session (stay/open
    new/return), Model and effort, and a filled Paste this prompt when needed.
    Persist decisions/progress in local records, tickets or PRs. Continue already
    authorised Autopilot stages without requiring each slash command. Preserve
    Approval workflow gates, requirements confirmation and explicit merge permission.
11. Explain that these instructions guide available tools; they do not install
    automatic workers. Do not launch extra implementation sessions unless requested.
    Preserve checkout/worktree rules and avoid concurrent edits in one checkout.
12. Include copyable starting, implementation, manual-review and resume prompts,
    plus an API-specific example (such as a clearly scoped validation bug).
    Continuation prompts must retain the existing Autopilot or Approval mode;
    a handoff must not silently convert Approval workflow into Autopilot.
13. Explain cached input versus new context, reasoning usage, and repeated setup.
    Compare total usage per completed ticket including reviewers and repairs;
    distinguish API costs from subscription usage. No fixed savings percentage.

Use the API repository's maintained skill source/installer where necessary so
updates survive reinstalling skills. Review the final instructions against these
conditions and the existing API workflow. Validate links and changed skills using
available validators; report missing tools rather than claiming checks passed.
For documentation-only work, avoid unrelated runtime tests unless local policy
requires them. Prepare a reviewable change on a branch from main and a PR under
the repository's issue/commit conventions. Report remaining limitations and the
next action. Do not merge without explicit authorisation.
```
