# 0008: Client state: no global state library

Status: Accepted
Date: 2026-11-05

## What it is for

Where state lives. Server state is in Query, filters are in URL search params, and the rest is local state. A library is added only when a need appears.

## Why it was chosen

With those three places taken, nothing is left for a global store to hold, and filters in the URL survive a reload and can be shared.

## What was not chosen and why

- Zustand, Redux: a solution with no problem yet.
