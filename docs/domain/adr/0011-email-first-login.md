# 0011: Email-first login reveals whether an account can log in

Status: Proposed
Date: 2026-11-17
Affects: api, web (requires direct coordination)

## Context

Login asks for an email and a password together, with separate "Set up your password" and "Forgot password" buttons. The owner wants Login to ask for the email first, check whether it matches a User, and send a first-time User straight into the First-time code flow instead of making them find a separate button. Today users-and-access R5 and R44 forbid revealing whether an email matches a User or has a password, so the change is a deliberate trade-off.

## Decision

Login starts with the email alone. Continuing asks the API what the email may do next:

- an Active User with a password continues to the password step;
- an Active Admin or Staff User without a password is sent a First-time code (within R43's limits) and continues to the code step;
- an unknown email and an Inactive User receive the same "no account" answer;
- the first Owner before installation setup is told to use the installation Setup link (R34 still sends nothing).

The email check is rate-limited per IP address by the API, high enough that normal logins from one shop network are not blocked. A failed password still shows one message whatever the reason. Public setup and recovery requests keep their neutral message.

## Consequences

Anyone can learn whether an email belongs to an Active User and whether it has a password set (user enumeration). The owner accepts this for a practice project, alongside the existing no-lockout decision; it should be revisited before any real data goes in. R5 narrows to the password step, R44 no longer holds for Login, and the "Set up your password" button on Login disappears. The API needs a new public operation; web integration waits for its published contract.

## Alternatives considered

A two-step Login that never reveals the account (always showing the password step with a "first time?" link) keeps R5 and R44 but does not route first-timers automatically; the owner chose the real check. Revealing Inactive status separately was rejected: it leaks more than existence for little benefit.
