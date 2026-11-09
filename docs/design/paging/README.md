# Paging evidence

Screenshots captured by `e2e/paging.spec.ts` and `e2e/reports.spec.ts` at 375, 768, 1024 and 1440 px. Each filename identifies the screen and viewport width. Paging was scrolled into view to show wrapping and unavailable directions. Refreshed after rebasing onto navigation PR #39 (`d75ffbaa931a5c92701ff9c5ee524cce9c6ffdbb`), so the evidence shows the integrated shell and paging. Both navigation and paging design additions remain in `docs/design.md`.

UI/UX pre-delivery check: existing tokens and type retained; phone controls use 44 px targets; native buttons and select preserve keyboard focus and accessible names; disabled directions remain visible; counts and older-page context use words; no horizontal page overflow at any target width. Light theme and reduced-motion behavior are unchanged.
