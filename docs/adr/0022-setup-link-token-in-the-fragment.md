# 0022: A Setup link carries its token in the URL fragment

Status: Accepted
Date: 2026-11-06

## What it is for

A Setup link is `<web origin>/set-password#<token>`. The web app builds it from its own origin, and a developer builds the Owner's from the token `cmd/install` prints. The page reads the token from the fragment and sends it only in request bodies.

## Why it was chosen

The record keeps the token out of request logs, and `stock-flow-api` makes its reads a POST for that reason. A token in the page's own address would undo that one hop earlier: Vercel logs the path and query of every page request to the web project. A fragment is never sent to a server and never appears in a `Referer` header.

## What was not chosen and why

- A query string (`?token=`): the usual shape, and in Vercel's request logs.
- A path segment (`/set-password/<token>`): the same, and it would also need a route param.
