# Session guide: from an idea to a pull request

Use this guide when starting work or deciding what to do next. The agent should guide you through the stages; you do not need to remember every command. [Workflow](workflow.md) remains the source for authorisation, requirements confirmation and repository ownership.

## Start here

For normal planning or feature work, choose **GPT-6.1 Sol / medium** in the session settings. Paste this prompt and replace the brackets:

```text
Autopilot: [describe the problem and desired result].
Scope: [what may change].
Follow docs/session-guide.md and docs/workflow.md.
Use the hybrid session approach. Guide me through each stage and tell me
when to open a new session, which model and effort to select, and what to paste.
Choose recommended options within scope and record decisions.
Continue through implementation PRs where authorised. Stop before merging.
```

Autopilot lets the agent make recommended choices within the agreed scope. Approval workflow waits for your decisions instead. Neither mode permits inventing unresolved product rules, changing another repository, or merging without explicit authorisation.

For a small, already understood fix, start with the implementation setting below and ask for the fix directly. A separate spec is not required when a local ticket or written acceptance conditions already describe the work.

## Choose sessions by task, not by command

**Keep requirements, `/to-spec` and `/to-tickets` together for one feature. Consider a fresh implementation session at a substantial ticket boundary. Review in separate focused contexts. Return to the implementation session for fixes and PR creation.**

A context is the instructions, messages and tool results available to an agent. A fresh context avoids carrying unrelated history, but repeats some setup and reading. Do not open a new session for every short command or test run.

Use this decision order before implementation:

1. **Stay** for a small fix, a short relevant discussion, or a ticket already progressing well. Stay for its tests, fixes and PR creation.
2. **Consider a new session** when planning contains many discarded ideas, the next ticket is independent, or most history is irrelevant. Prefer a fresh session when a compact written handoff can replace that history.
3. **Write missing decisions first.** Do not hand off while important decisions exist only in chat. If the remaining task needs that discussion, stay until it is recorded.
4. **Check settings separately.** A different model or effort does not itself require a new session if the host supports changing it. If settings cannot be changed here, offer a fresh session with the requested settings.

A large ticket alone does not force a new session. Explain the expected benefit before recommending a handoff; no fixed token threshold or guaranteed savings is assumed.

| Stage | Session and starting settings | What the agent does | What you do next |
| --- | --- | --- | --- |
| Understand and define | Planning session; Sol / medium | Read the record, inspect relevant code, identify scope and unknown rules. Use `/grill-with-docs` when requirements need definition. | Answer questions that need your product decision. Otherwise let Autopilot proceed. |
| Confirm changed requirements | Same planning session | Open the record PR. Requirements become confirmed through its merge. | Review and merge, or explicitly authorise the agent to merge after checks. Dependent implementation waits for confirmation. |
| `/to-spec` | Same planning session; Sol / medium | Turn settled requirements into a spec, define the test boundary, and publish the local spec issue. | In Autopilot, no separate command is needed when this stage is in scope. |
| `/to-tickets` | Same planning session; Sol / medium | Split the spec into independently verifiable tickets, record dependencies and authorisation, and publish them. | Take the next unblocked, authorised ticket. The agent supplies its handoff. |
| `/implement <ticket>`: small, clear fix | Fresh session when the handoff is useful; GPT-6.1 Terra / medium | Inspect the ticket, use test-first development, make the change and run required checks. | Paste the implementation handoff. Keep this session for subsequent fixes. |
| `/implement <ticket>`: normal feature | Stay when context is relevant; consider a fresh session at a substantial ticket boundary; GPT-6.1 Sol / medium | Build the ticket on a branch from `main`, using relevant skills and the accepted API contract. | Let implementation, verification and review proceed within scope. |
| Difficult diagnosis or conflicting evidence | Keep the relevant task session; Sol / high | Investigate the cause or conflict. Consider Astra / high if the stronger setting still fails to resolve it. | Change settings only when the agent explains why. Unresolved product decisions still need you. |
| `code-review` | Separate review contexts; Sol / medium | Review the committed changes and any in-scope uncommitted implementation changes against a fixed starting point. Use Standards and Spec agents; skip Spec only when no spec is available. | No manual session needed when configured reviewer agents support these settings. Otherwise use the review prompt below. |
| Fix findings and verify | Return to the implementation session and its settings | Fix findings and rerun affected checks. Record any remaining findings in the PR. | Do not start a fresh session for each finding. |
| Commit and open PR | Same implementation session | Commit with the ticket reference and fill every PR template section with verification evidence. | Review the PR. Merge only after required checks and explicit authorisation. |
| Finish and next ticket | Planning session, or a fresh planning session using the published issues | Report what passed, remaining blockers, PR status and the next ready ticket. Close a ticket only when its acceptance conditions are met. | Merge or give the next scoped instruction. Do not implement a blocked ticket. |

Sol means GPT-6.1 Sol; Terra means GPT-6.1 Terra; Astra means GPT-6 Astra. These are starting recommendations, not measured winners for this repository. Use available equivalents only after explaining the substitution. Do not silently replace an unavailable model.

Review starts automatically as part of `/implement`; you do not need another command. The repository's `code-review` skill explicitly requests `gpt-6.1-sol` / `medium` for each reviewer with fresh context, even when implementation uses another model or effort. In Codex this uses `fork_turns: "none"`, not an inherited conversation. If the host cannot apply those settings, the agent reports the limitation and supplies the manual review handoff below. These instructions configure how agents request reviews; they cannot add unsupported host capabilities.

### Repository review policy

This policy remains authoritative if reinstalling upstream skills replaces local skill edits. Each reviewer receives the repository instructions/path, its task, pinned base and reviewed commit, diff commands, commit list and its standards or spec sources. It may inspect relevant code and dependencies, but does not inherit the implementation conversation or edit files. Request `gpt-6.1-sol` / `medium` explicitly and use fresh context (`fork_turns: "none"` in Codex). Report requested settings and whether the host confirms the effective settings; do not silently inherit implementation settings.

Pre-commit review must include the branch comparison and in-scope staged, unstaged and new files. Capture `git diff <base>...HEAD`, `git diff HEAD -- <in-scope-paths>`, and the in-scope new files listed by `git ls-files --others --exclude-standard`; read new files directly. Record exact base/HEAD SHAs and reviewed paths, keep the working state unchanged during review and exclude unrelated dirty files. Refresh affected review if the state changes.

Run one initial review per applicable axis, with reports under 400 words per axis. Revisit affected hunks and requirements after fixes instead of repeating the whole review unless scope changes. Escalate settings only for a stated unresolved difficulty. If the host cannot apply explicit reviewer settings, supply the manual handoff below. If subagents remain unavailable in that fresh session, perform separate Standards and Spec passes there and disclose reduced isolation; never repeat the same failed handoff indefinitely.

For a small task already in progress, staying in the current session may cost less than a handoff. Routine ticket formatting or PR drafting can use **GPT-6 Luna / low** when already running as a separate bounded task. Do not create another session solely to write a short PR description.

## What the agent must handle for you

- Read this guide when starting or continuing the hybrid workflow.
- State the current stage and recommended settings at the beginning of substantial work. Do not claim to know the active settings unless the host exposes them.
- Continue through authorised stages in Autopilot. Do not require a separate slash command for each stage. In Approval workflow, preserve the required decision gates.
- Recommend a new session only at a useful boundary: an implementation ticket, an independent review, or a task whose existing context is mostly irrelevant.
- Before handing off, record decisions and progress in the relevant local record, issue or PR. Provide a short prompt with exact links and branch details. Avoid copying the whole conversation.
- If worker tooling is available and you have requested automatic worker sessions, create them with explicit settings and focused context. Otherwise tell you which session to open and what to paste. This guide alone does not configure worker automation or change the active model.
- Keep independent implementation work sequential in one checkout. Use a separate worktree only when explicitly requested. Reviewers inspect the same branch without editing it.
- At each completed stage, report **Next action**, **Session: stay / open new / return**, **Model and effort**, and a **Paste this** prompt when needed. State a specific blocker if work cannot continue.
- Before a pause, leave enough durable progress for a new session to resume without reconstructing the conversation.

## Copyable handoffs

The outgoing agent fills every bracket before giving you a handoff. A handoff preserves scope and existing authorisation; it does not create new permission.

### Start implementation

Select **Terra / medium** for a small clear fix or **Sol / medium** for a normal feature. Open this repository in the new session and paste:

```text
[Existing work mode: Autopilot or Approval workflow]: /implement [local ticket URL or written acceptance conditions].
Read AGENTS.md, docs/workflow.md and docs/session-guide.md.
Requirements/spec/design: [exact links and rule IDs, or why not applicable].
Authorisation and scope: [owner instruction or ticket reference].
Decisions and open questions: [short summary with durable links].
Dependencies: [satisfied blockers and any genuinely blocked portion].
Branch: [create from main, or exact existing branch and current commit].
Test boundary: [screen/component/interface and required behaviour].
Use the repository's required skills and checks. Run code-review against
[exact base commit or branch], then fix findings and open the implementation PR.
Stop before merging. Report the next action and session settings.
```

The outgoing agent fills the existing mode without changing it. Approval workflow does not become Autopilot during a handoff.

### Start a separate review when automatic reviewers are unavailable

Select **Sol / medium**, open this repository in a new session, and paste:

```text
Review only. Read AGENTS.md and docs/session-guide.md.
Branch and reviewed commit: [exact branch and SHA].
Use code-review against [exact base commit or branch].
Ticket/spec: [exact links or written acceptance conditions].
Use GPT-6.1 Sol / medium and separate Standards and Spec review agents where
supported. If subagents or their explicit settings are unavailable, perform
both review axes yourself in this fresh session and report the reduced isolation.
Include in-scope uncommitted changes and new files; state the reviewed file list.
Do not edit files, commit, or merge. Return findings with locations and reasons
for the implementation session to address.
```

### Return to implementation after review

Return to the original implementation session and paste:

```text
Continue the same authorised ticket. Review findings: [report or durable link].
Address findings within scope, run affected checks, and open or update the PR.
Record unresolved findings and verification evidence. Stop before merging.
```

If the original session is unavailable, use a fresh session with its ticket, branch, latest commit, progress and review findings.

## Example: fix a UI design

Start with **Terra / medium** when the defect and desired result are clear; use **Sol / medium** if design decisions remain. Paste:

```text
Autopilot: fix the Products page on mobile. Filters overflow, spacing feels
crowded, and row actions are hard to tap. Follow docs/design.md and preserve
existing behaviour. Read docs/session-guide.md and guide me through the hybrid
workflow. Create a focused local ticket if needed. Stop before merging.
```

The agent checks the design record and existing components, loads shadcn and the required design skills, and defines acceptance conditions. A small fix can continue in this session. A substantial fix gets a ticket and a fresh implementation handoff.

If `docs/design.md` is unfilled, plan the design first. If the requested fix changes the design direction, create a separate design PR for owner approval. Do not infer new token values from screenshots or change business behaviour as part of a visual fix.

## Control usage without losing quality

Reasoning effort controls how much internal thinking a model applies. Start at medium for technical work; increase it for a demonstrated difficulty instead of using high or extra high everywhere.

Prompt caching reuses an unchanged beginning of the input at a discounted rate. A fresh session or model change can lose that benefit. A new session is not automatically cheaper, and a cheaper model can cost more if it requires repeated repairs.

Compare total usage per completed ticket, including planning, handoffs, reviewer agents and fixes. Where available, record uncached input, cached input, output/reasoning, elapsed time and repair rounds. API token prices do not establish exact subscription usage. Do not promise a savings percentage without measurement.

Recommendations checked on 2026-11-11. Recheck model availability and guidance when choices change:

- [Official model selection](https://developers.openai.com/api/docs/guides/model-selection)
- [Reasoning effort](https://developers.openai.com/api/docs/guides/reasoning)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Independent agent contexts and delegation](https://developers.openai.com/api/docs/guides/agents-api/multi-agent)

Verification and completion requirements still come from [AGENTS.md](../AGENTS.md), [testing policy](agents/testing.md) and [workflow](workflow.md).

To apply the same approach in the API repository, use the [API session-workflow handoff](agents/api-session-workflow-handoff.md). That repository adapts and validates its own rules.
