# 0002: Routing: TanStack Router, file-based

Status: Accepted
Date: 2026-11-05

## What it is for

Client-side routing. Routes are files in `src/routes/`; `@tanstack/router-plugin` generates `src/routeTree.gen.ts`, which is committed so a fresh checkout typechecks. Test files beside a route are kept out of the tree by `routeFileIgnorePattern`.

## Why it was chosen

Links, params and search params are type-checked, and filters live in search params (ADR 0008), so a typed search is worth having. It is also chosen to learn it.

## What was not chosen and why

- React Router: the established choice, and looser about types. Job-market share is not a criterion here.
