# 0013: Versions: latest stable of everything

Status: Accepted
Date: 2026-11-05

## What it is for

The latest stable of each dependency when the stack was scaffolded, 2026-11-05: React 19.3.1, TypeScript 7.0.2, Vite 8.3.5, TanStack Router 1.170.46 (plugin 1.168.48), Query 5.106.0, Form 1.33.5, Table 9.3.1, Orval 8.46.0, Tailwind 4.3.4, Zod 4.6.7, Vitest 5.1.0, MSW 3.0.3, Playwright 1.64.1, oxlint 1.91.0, oxlint-tsgolint 7.0.2005, oxfmt 0.76.0, Bun 1.4.4, shadcn CLI 4.23.0.

## Why it was chosen

This is a practice project, and these APIs are the point of it. Where two don't work together, the rule is to step one back a major and say why in its ADR. Nothing needed stepping back.

## What was not chosen and why

- Pinning to older, widely used majors: safer, and the opposite of the project's goal.
