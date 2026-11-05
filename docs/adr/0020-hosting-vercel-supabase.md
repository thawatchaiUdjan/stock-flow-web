# 0020: Hosting: Vercel Hobby and Supabase, in Singapore

Status: Proposed
Date: 2026-11-05

## What it is for

Everything runs on Vercel Hobby plus Supabase, at $0 with no card. Two Vercel projects in `sin1`: web and api. Supabase Free in `ap-southeast-1`, connected to the api project only. The web project holds no Supabase variables.

## Why it was chosen

A shared decision, restated here for what it forbids in this repo: no Supabase client and no Supabase variable. Every API response sends `Cache-Control: no-store`, because Vercel caches external rewrites by the upstream header; `/api/health` through the dev proxy showed the header.

Proposed until the web project exists and its preview is checked (ADR 0016).

## What was not chosen and why

- Paid hosting: not justified for a practice project.
