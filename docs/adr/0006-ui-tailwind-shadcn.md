# 0006: UI: Tailwind CSS v4 and shadcn/ui on Radix

Status: Accepted
Date: 2026-11-05

## What it is for

Styling and components. Tailwind v4 through `@tailwindcss/vite`; shadcn/ui components copied into `src/components/ui/`, where the repo owns them. Initialised with `-b radix`, because the CLI's default base is Base UI. `components.json` holds the configuration.

## Why it was chosen

Components owned in the repo can follow `docs/design.md` exactly, and Radix supplies the accessibility.

The theme in `src/index.css` is shadcn's Nova preset, a placeholder: `docs/design.md` isn't written yet, and "plan the design" replaces these tokens. shadcn's current template uses its own `cn` package in place of `clsx` + `tailwind-merge`.

## What was not chosen and why

- A packaged library (MUI, Mantine): its look has to be fought to match a design direction.
- shadcn on Base UI: the CLI's default, but the decision is Radix.
