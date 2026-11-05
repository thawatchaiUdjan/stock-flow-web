# 0003: Server state: TanStack Query v5

Status: Accepted
Date: 2026-11-05

## What it is for

Everything fetched from the API: caching, refetching, loading and error states. Orval generates the hooks (ADR 0004), so screens call a generated hook and never `fetch`.

## Why it was chosen

It is what Orval generates for, and it removes the need for a global store (ADR 0008).

## What was not chosen and why

- Hand-managed state around `fetch`: every screen would rewrite caching and loading badly.
- SWR: smaller, with a weaker mutation story, and no reason to prefer it here.
