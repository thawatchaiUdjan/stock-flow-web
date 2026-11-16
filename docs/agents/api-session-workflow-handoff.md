# Handoff: adopt the session workflow in the API repository

Open a new session rooted in `stock-flow-api`. Select the **Standard / medium** tier (Claude Code: Claude Sonnet 5.5 with `/model` and `/effort`; Codex: GPT-6.1 Sol) and paste the prompt below. This is a documentation and skill-workflow task, not a request to change API behaviour. The web session has not edited the API repository.

The prompt is self-contained. The optional web references are working-tree files as of 2026-11-16. The tier and Claude Code files (`CLAUDE.md`, `.claude/agents/`, `.claude/settings.json`) are on web `main` (PR #63). The Claude Code usage guidance in condition 15 exists only on the unmerged web branch `docs/claude-model-usage-guidance`; do not treat it as published until that pull request is merged.

```text
Autopilot: adopt a practical session and reviewer-settings guide in this API
repository, usable from both Codex and Claude Code. I authorise this workflow/documentation change. Work only here;
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
C:/ProjectsDev/projects/stock-flow/stock-flow-web/CLAUDE.md
C:/ProjectsDev/projects/stock-flow/stock-flow-web/.claude/agents/standards-reviewer.md
C:/ProjectsDev/projects/stock-flow/stock-flow-web/.claude/agents/spec-reviewer.md
C:/ProjectsDev/projects/stock-flow/stock-flow-web/.claude/settings.json
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
4. Starting recommendations, by tier (Codex / Claude Code): Standard / medium
   (GPT-6.1 Sol / Claude Sonnet 5.5) for planning and normal feature
   implementation; Light / medium (GPT-6.1 Terra / Claude Sonnet 5.5) for small
   clear fixes; Standard / high for demonstrated difficult diagnosis, considering
   Deep / high (GPT-6 Astra / Claude Opus 5.5) if needed. Optional Routine / low
   (GPT-6 Luna / Claude Haiku 5.5) for an already separate routine formatting
   task. Recheck actual availability; explain substitutions. No guaranteed savings.
5. Make review automatic after implementation and required checks, before PR
   completion. Preserve the local Standards and Spec axes. Explicitly request
   the Standard tier at medium effort for each reviewer unless the owner
   overrides them: model gpt-6.1-sol and reasoning_effort medium in Codex. For
   Codex spawn_agent use fork_turns none so settings can be overridden without
   inheriting the whole implementation conversation. In Claude Code use two
   project agents in .claude/agents/ (a Standards and a Spec reviewer) pinned to
   model sonnet and effort medium, with read-only tools (Read, Grep, Glob, Bash;
   no Edit or Write), started as fresh agents and never forks. Use equivalent
   supported controls in other hosts.
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

14. Support Claude Code as well as Codex. Make CLAUDE.md a real file that
    imports AGENTS.md (@AGENTS.md) instead of a symlink, so a Windows checkout
    without symlink support still loads the rules. Add the Claude Code reviewer
    agents from condition 5 and confirm the skill installer leaves them alone.
    Review .claude/settings.json: allow only commands this repo's workflow
    docs name (git, read-only gh issue/pr/run, its test, build and generation
    commands) and keep the deny list for merge, force-push and git -C. Do not
    add GitHub write commands the owner has not approved.
    Ignore generated bytecode such as __pycache__/.
15. Add Claude Code usage guidance to the session guide. Escalate from Sonnet to
    Opus only when Sonnet at high effort has not resolved a stated difficulty
    after two focused attempts (a fix followed by a check that still fails), and
    return to Sonnet once it is resolved; mark this threshold as an unmeasured
    proposal. Explain that on a subscription plan Opus uses meaningfully more
    quota than Sonnet, that /model shows which models the account can use and
    /usage shows plan usage limits, and that a trial notes /usage before and
    after a ticket with model, effort and repair rounds. Cite Anthropic's
    "Models and usage limits in Claude Code" help page and the Claude Code
    commands page with the date checked. Do not claim which plan includes
    Opus; that varies by account.

Use the API repository's maintained skill source/installer where necessary so
updates survive reinstalling skills. Review the final instructions against these
conditions and the existing API workflow. Validate links and changed skills using
available validators; report missing tools rather than claiming checks passed.
For documentation-only work, avoid unrelated runtime tests unless local policy
requires them. Prepare a reviewable change on a branch from main and a PR under
the repository's issue/commit conventions. Report remaining limitations and the
next action. Do not merge without explicit authorisation.
```
