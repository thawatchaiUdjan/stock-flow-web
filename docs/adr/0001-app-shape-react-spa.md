# 0001: App shape: React, TypeScript and Vite, a single-page app

Status: Accepted
Date: 2026-11-05

## What it is for

The shape of the frontend: React 19, TypeScript 7 in strict mode, and Vite 8 as dev server and bundler, producing a single-page app of static files.

## Why it was chosen

Everything sits behind a login, so there is no SEO need for server rendering, and Go is already the server. A static bundle keeps one server in the system. The project is practice for frontend development, so this repo picks the best current tool (`AGENTS.md`, *Project goal*).

## What was not chosen and why

- Next.js: it would add a second server to run and reason about, for rendering nothing here needs.
