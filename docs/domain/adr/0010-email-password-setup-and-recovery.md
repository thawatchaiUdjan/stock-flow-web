# 0010: Email password setup and self-service recovery

Status: Accepted by explicit owner adoption request; PR pending
Date: 2026-11-11
Affects: web

## Context

The owner explicitly requested Autopilot adoption in web #60 of the email-auth handoff at API commit fbcc38a2a53a9638e08a03b5a02a2f2970acf1c9. API PR #45 already confirmed these product rules. Local legacy rules still described Owner-issued links.

## Decision

Adopt users-and-access R27-R34 and R41-R49 from the confirmed API record. This supersedes domain ADR 0002 for Admin/Staff first-time setup and domain ADR 0003 for ordinary Owner recovery. Preserve the first Owner's developer-issued, 24-hour installation link without email or OTP. Ordinary logins remain email/password only.

Users request their own instructions. Six-digit First-time codes and verification grants last 10 minutes; Reset links last 30 minutes. Password submission returns to Login without automatic login. Reset ends all sessions. Owner creation reports creation and email-delivery outcome separately, and never exposes a code or link. Password policy stays at six characters. API owns templates and email delivery.

## Consequences

New public setup/recovery screens reuse the existing auth design. Owner reset/reissue/copy-link actions disappear. Reset fragments are captured in memory and replaced in history; credentials never enter persistent storage or telemetry. Existing email immutability and role/status controls remain. Live provider setup and later legacy endpoint retirement need their own authorisation.

## Alternatives considered

Retaining Owner-mediated links conflicts with the confirmed email flow. OTP on every login adds an unrequested step. Recreating email templates in web would duplicate API ownership.

## Sources

- https://github.com/thawatchaiUdjan/stock-flow-web/issues/60
- https://github.com/thawatchaiUdjan/stock-flow-api/pull/45
- https://github.com/thawatchaiUdjan/stock-flow-api/blob/fbcc38a2a53a9638e08a03b5a02a2f2970acf1c9/docs/handoffs/email-auth-web.md
