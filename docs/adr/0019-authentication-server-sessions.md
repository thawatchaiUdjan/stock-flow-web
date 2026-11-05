# 0019: Authentication: server-side sessions in a first-party cookie

Status: Proposed
Date: 2026-11-05

## What it is for

Sessions are owned by the Go API, in a cookie that is `HttpOnly`, `Secure` and `SameSite=Lax`. There are two roles, owner and staff. No token is in browser storage. The browser talks only to the web origin, and `/api/*` is rewritten to the api (ADR 0016), so the cookie is first-party and no CORS is needed.

## Why it was chosen

A shared decision, restated here because the rewrite exists for it. `HttpOnly` keeps the session away from any script on the page.

Proposed until a Vercel preview shows a `Set-Cookie` from the API reaching the browser.

## What was not chosen and why

- Tokens in browser storage: readable by any script on the page.
- Supabase Auth: the API owns sessions.
