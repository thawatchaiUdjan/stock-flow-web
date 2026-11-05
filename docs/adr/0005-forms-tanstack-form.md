# 0005: Forms: TanStack Form with Zod through Standard Schema

Status: Accepted
Date: 2026-11-05

## What it is for

Forms use TanStack Form 1.x, validated by Zod 4 through Standard Schema (no adapter), on shadcn's `Field` components (shadcn's TanStack Form guide). API errors map onto fields by `errors[].location` (for example `body.quantity`), read from `ApiError.problem` (ADR 0004). No form exists yet, so the first one adds `Field` and that mapping.

## Why it was chosen

Type-safe fields, and the validators can be the Zod schemas Orval generates from the contract. Client validation then cannot be stricter than the server without someone writing that by hand.

## What was not chosen and why

- React Hook Form: mature, but it needs a resolver adapter, and TanStack Form fits the rest of the stack.
