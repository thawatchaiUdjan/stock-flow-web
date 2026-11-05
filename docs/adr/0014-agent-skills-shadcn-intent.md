# 0014: Agent skills: shadcn and TanStack Intent

Status: Accepted
Date: 2026-11-05

## What it is for

Two additions, because these APIs are newer than the agents' training. The `shadcn` skill (from `shadcn-ui/ui`, in `OTHER_SKILLS` in `scripts/install-skills.sh`), and TanStack Intent's guidance block in `AGENTS.md` for Router and Table. Each has a when-to-use line in `AGENTS.md` and a row in the README.

## Why it was chosen

Skills shipped with the library match the installed version.

Verified: TanStack Intent under Bun, including with the isolated linker. `intent list` finds the packages, and `intent install` writes the block. `intent install` needs an interactive terminal unless `intent.skills` is configured, so it is set in `package.json`, which also limits Intent to Router and Table (it would otherwise offer `dotenv`'s skills too).

The `shadcn` skill offers `apply` and presets, which change the theme. Its when-to-use line rules them out: the direction lives in `docs/design.md`.

## What was not chosen and why

- `intent hooks`: they would write `.claude/settings.json` and gate every edit.
- `vercel-react-best-practices`: many of its rules are Next.js-only.
