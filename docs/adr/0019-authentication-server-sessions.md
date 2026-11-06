# 0019: Authentication: server-side sessions in a first-party cookie

Status: Accepted
Date: 2026-11-05

## What it is for

Sessions are owned by the Go API, in a cookie that is `HttpOnly`, `Secure` and `SameSite=Lax`. There are three Roles, Owner, Admin and Staff (context ADR 0001). No token is in browser storage. The browser talks only to the web origin, and `/api/*` is rewritten to the api (ADR 0016), so the cookie is first-party and no CORS is needed.

## Why it was chosen

A shared decision, restated here because the rewrite exists for it. `HttpOnly` keeps the session away from any script on the page.

Accepted on 2026-11-06 by the hand check of ticket #7: on a Vercel preview, the requirements owner saw the API's `Set-Cookie` for `session` reach the browser through the rewrite, stored as `HttpOnly`, `Secure` and `SameSite=Lax`, and a reload stayed logged in.

## What was not chosen and why

- Tokens in browser storage: readable by any script on the page.
- Supabase Auth: the API owns sessions.
