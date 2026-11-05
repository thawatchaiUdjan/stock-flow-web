# 0016: CD: Vercel Git integration

Status: Proposed
Date: 2026-11-05

## What it is for

The web project deploys through Vercel's Git integration, region `sin1`: production from `main`, a preview per pull request. `vercel.json` holds the SPA fallback to `/index.html` and the `/api/:path*` rewrite to the api's production URL, `https://stock-flow-api-ten.vercel.app` (`stock-flow-api`'s `keepalive.yml` has the real domain; its ADR 0017 still shows an older example).

## Why it was chosen

A preview per pull request costs nothing to run. The rewrite keeps the browser on one origin (ADR 0019). A rewrite doesn't expand variables, so the URL is a literal.

Proposed until a Vercel preview shows `/api/health` reaching the api and a `Set-Cookie` reaching the browser. If it doesn't, the fallback is one custom domain for both.

## What was not chosen and why

- Deploying from GitHub Actions, as the api does: the api needs migrations first, and a static site has no such step.
