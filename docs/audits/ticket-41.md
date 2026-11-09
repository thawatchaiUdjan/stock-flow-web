# UI audit: ticket #41

Spec: [context #29](https://github.com/thawatchaiUdjan/stock-flow-context/issues/29).
Rules: navigation-and-lists R3–R7; dashboard-and-reports R1, R4–R8.
The coordinator clarified on web #41 that zero-sale days remain in the daily table;
the old test forbidding that table was replaced. The no-sales message and hidden
zero-sales chart are preserved.

## Reproduction and corrections

- At 1024 px, the original short Product cell measured 77.8 px beside a 228.8 px
  empty Note cell. Product and Note now each have a 192 px minimum and share spare
  width. Long notes wrap; constrained desktops scroll inside the table surface.
  Complete notes also remain visible in phone rows.
- The original 375 px navigation required 512 px of horizontal space. Its background
  was already opaque on current main, but destinations extended beyond the screen.
  A two-column grid above the content now exposes every permitted destination,
  with full labels, 44 px minimum targets, 8 px gaps and no content overlay.
- All four date inputs now share a native control, an explicit full-year display,
  Today and Clear. Reports and history retain their original query defaults.
- Reports previously omitted paging during loading, failure and no-sales states.
  Paging now stays visible, zero-sale daily rows page normally, and an actual empty
  daily response has explicit guidance and disabled unavailable directions.

## Full-list inventory

| List | API and page boundary | Browser findings |
| --- | --- | --- |
| Products | Offset, total, sizes 10/25/50 | Existing paging works; search, size, next/reload/first and page-999 recovery verified. |
| Orders | Offset, total, sizes 10/25/50 | Existing paging works; Pending filter, size, next/reload/first and page-999 recovery verified. |
| Users | Complete API response, client pages 10/25/50 | Existing paging works; size, next/reload/first and page-999 recovery verified. A real install always has its Owner, so an empty visible page is tested through page 999. |
| Stock movements | Cursor, 50 entries | Older/newest, retained Kind, reload, terminal/empty older page and recovery verified. No invented totals. |
| Login log | Cursor, 50 entries | Existing paging is present and works in the browser, including Result filter, reload, older/newest and empty-older recovery. The old crowded phone shell made it hard to reach; the corrected shell leaves paging clear at the bottom. |
| Reports daily sales | Complete range, client pages of 25 | Next/reload/first and page-999 recovery preserve From/To. Chart and aggregates still describe the whole range. Zero-sale days remain pageable; empty response/loading/error states keep controls visible. |

All six were driven with populated, single-page and empty-visible-page data at
375, 768, 1024 and 1440 px. Loading and API failure were injected through generated
MSW handlers for each list at 375 px; unavailable forward controls were disabled
and the pending response was released to verify recovery. The shared shell and
paging controls had no page-level horizontal overflow. Populated fixtures contain
60 Products/Orders/Users and 110 history entries, with contract-shaped long content.

### Bounded exceptions

Dashboard restock remains bounded to 10 Products, newest Orders to 5 and its chart
to 14 days. Reports Top products remains bounded to 20. Order line items are the
detail of one Order. None receives artificial paging. The chart's expandable
figures on Dashboard still show its entire bounded 14-day series.

## Date-control inventory

| Screen | Controls | Empty display and semantics |
| --- | --- | --- |
| Stock movements | From, To | “Any date”; omitted bounds stay unbounded, with no min/max date restriction. |
| Reports | From, To | “Default: start of the To month” / “Default: today in Bangkok”; the API still chooses this month so far by default. |

These are all date inputs in `src/`; Orders and Login log have no date input.
At every target width, each field was selected, changed with a native keyboard
arrow, cleared with keyboard activation and reloaded from its URL. Both Today
actions were tested at `2026-11-09T18:30:00Z` with the visitor in Los Angeles:
the selected day was **10 Nov 2026** in Bangkok. Date-only displays retain their
written day independently of visitor zone. Reports' reset clears both bounds and
restores its confirmed month-so-far range. Changing history dates clears the cursor.

## Chart colours

Current main already uses the same `SalesByDay` component and valid Forest/Ink
tokens for both screens; no colour change was needed. Browser computed values
were **rgb(58, 107, 79)** for Forest and **rgb(32, 38, 31)** for Dashboard's positive
today bar, with positive rendered heights. Reports' single series resolves to
the same Forest. This implementation renders **HTML bars, not SVG bars**: there
are zero SVG elements inside either chart figure. Consequently the meaningful
rendered measurement is `background-color`, rather than a nonexistent SVG fill.
The SVG icons are unrelated to the charts. Screenshots below show the actual bars.

## Visual and interaction evidence

Saved Chromium screenshots (mock API, no real user data):

| Width | Long Stock movements | Login log at the bottom | Readable dates |
| --- | --- | --- | --- |
| 375 | [Stock](ticket-41/stock-375.png) | [Login log](ticket-41/login-log-bottom-375.png) | [Dates](ticket-41/dates-375.png) |
| 768 | [Stock](ticket-41/stock-768.png) | [Login log](ticket-41/login-log-bottom-768.png) | [Dates](ticket-41/dates-768.png) |
| 1024 | [Stock](ticket-41/stock-1024.png), [scroll to Note](ticket-41/stock-notes-1024.png) | [Login log](ticket-41/login-log-bottom-1024.png) | [Dates](ticket-41/dates-1024.png) |
| 1440 | [Stock](ticket-41/stock-1440.png) | [Login log](ticket-41/login-log-bottom-1440.png) | [Dates](ticket-41/dates-1440.png) |

[Owner phone navigation](ticket-41/navigation-owner-375.png),
[Dashboard colours](ticket-41/dashboard-colors-1440.png),
[Reports colours](ticket-41/reports-colors-1440.png).

Owner, Admin and Staff navigation was checked at all four widths (7, 5 and 3
destinations respectively), with role restrictions, active state and visible
keyboard focus intact. Scroll-to-bottom leaves the pager unobscured. Landscape
812 × 375, reduced motion and 200% text scaling at 375 px also passed overflow
checks. Safe-area padding covers all four edges without a fixed phone overlay.

The ui-ux-pro-max pre-delivery checklist was applied to the changed web UI:
existing semantic colours/type/spacing, Lucide icon consistency, full labels,
field descriptions, disabled actions, native keyboard controls, visible focus,
44 px phone controls, safe-area clearance and reduced motion pass. Dark mode and
native iOS/Android-specific checks do not apply to this light-only web app.
Device-notch geometry is represented by CSS environment insets; no physical-device
claim is made. Slow end-to-end tests remain CI-only under `docs/agents/testing.md`.

The required CI presentation regression covers all four widths. Local visual
audit scripts and structured measurement results are retained in ignored
`test-results/`; raw Codex transcripts remain in the local session store.
