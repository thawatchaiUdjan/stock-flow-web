# Design direction

The one visual direction every screen follows, so that screens built by different agents, in different sessions, look like one product. Made once, before the first screen: from a Figma file or brand guide when there is one, otherwise drafted with `ui-ux-pro-max` and reviewed with `frontend-design` (`AGENTS.md`, *Design*). Changed only on purpose, in its own pull request.

## Figma source

"None" when the direction was not drawn in Figma. Exports and how to make them: [design files](design/README.md).

| File | Last exported | By |
| --- | --- | --- |
| None | | |

## Subject

StockFlow is a small inventory and order system for a shop or small warehouse. Its users are the Owner, Admins and Staff (context ADR 0001), working mostly at a desktop and sometimes on a phone. The one job its screens must do well: show what is in stock and what is running low, at a glance, while orders are being worked.

The planned screens are Login, Set password, Dashboard, Product List, Product Form, Stock Movements, Orders List, Create Order and Reports. That list describes the product's shape. It sets no rule: every rule comes from `stock-flow-context`.

The look is calm, readable and modern. It was chosen by the requirements owner over three bolder directions, which they found too stylized.

## Color

Light theme only. Dark mode would be a change of direction. Values live in `src/index.css`; components use the token, never the hex.

| Name | Value | Token | Role |
| --- | --- | --- | --- |
| Forest | `#3A6B4F` | `primary`, `ring`, `chart-1` | The one accent: primary buttons, selected navigation, focus, chart bars, healthy stock level |
| Fern | `#E6F0E8` | `secondary`, `accent` | Soft tint behind selected navigation |
| Ink | `#20261F` | `foreground` | Text and the minimum marker |
| Moss | `#5C6558` | `muted-foreground` | Secondary text: SKUs, labels, table headers |
| Page | `#F6F7F4` | `background` | The page behind surfaces, table header rows |
| White | `#FFFFFF` | `card`, `popover`, `sidebar` | Surfaces, and text on Forest |
| Hover | `#EEF0EA` | `muted` | Hover on rows and quiet controls |
| Line | `#E2E5DD` | `border` | Rules between surfaces and rows; the empty part of a level bar |
| Control | `#899183` | `input` | Borders of inputs, selects and quiet buttons |

State colors appear only where stock or an action needs attention, and always beside a word, never alone.

| Name | Text | Background | Fill | Tokens | Role |
| --- | --- | --- | --- | --- | --- |
| Warning | `#8A5A00` | `#FBF1DC` | `#A66E00` | `warning`, `warning-soft`, `warning-fill` | Low stock |
| Danger | `#B3261E` | `#FBE9E7` | `#B3261E` | `destructive`, `destructive-soft` | Out of stock, errors, destructive actions |

Every pair in use meets WCAG AA: 4.5:1 for text, 3:1 for control borders and level bars. Re-measure any value that changes.

Charts use Forest for a single series, including today's bar. A chart with several series needs a palette this direction doesn't have yet: ask, don't invent one.

## Type

**Figtree** (`@fontsource-variable/figtree`) for everything, with **Noto Sans Thai** (`@fontsource-variable/noto-sans-thai`) as its fallback. Figtree has neither the baht sign nor Thai, so the fallback is what renders `฿` and any Thai a user types. The UI itself is English (ADR 0009).

Numbers are always tabular (`font-variant-numeric: tabular-nums`, set on `body`), so columns of figures line up. Right-align them.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Page title | 24 / 30 px | 650 |
| Key figure (dashboard) | 30 / 38 px | 650 |
| Stock count in a table | 16 / 24 px | 650 |
| Section heading | 15 / 22.5 px | 600 |
| Body, table cells | 15 / 22.5 px | 400 |
| Names, navigation, buttons | 15 / 22.5 px | 500 or 600 |
| Small: SKUs, table headers, badges, chart axes | 13 / 18 px | 400 to 600 |

Inputs are 16 px on a phone, so the browser doesn't zoom on focus. Nothing is smaller than 12 px. Headings get `-0.015em` tracking; nothing is set in capitals.

Date trigger prompts and selected values use the same Figtree regular (400) type as Kind / All kinds: 15 px on desktop and 16 px below the shell breakpoint. Calendar month/year captions use the existing 15 px body size at medium (500) weight.

Calendar columns have a 4 px gap between day backgrounds, with weekday headings aligned to those columns. Keep the complete day targets at 44 px on phones and 40 px on desktop. Previous year and Next year use the existing outline button variant with the Control border, Page background, Hover feedback and shared visible focus; their affordance stays visible before interaction. In short viewports, the calendar scrolls within the available popover height so every day and year action stays reachable. These shared treatments apply to both bounds on Stock movements and Reports (#45).

## Layout

A white sidebar on the left and the work on the page beside it. Everything is left-aligned, except numbers.

```
Desktop                                  Phone (below 800 px, navigation above content)
┌────────┬──────────────────────────┐    ┌──────────────────┐
│ Stock  │ Title         [+ Action] │    │ Name    [Log out]│
│ Flow   │ ┌──────────────────────┐ │    ├──────────────────┤
│        │ │ figure│figure│figure │ │    │ Title   [+ Action]│
│        │ └──────────────────────┘ │    │ [Search        ] │
│ ▣ Dash │                          │    │ ┌──────────────┐ │
│ ▢ Prod │ ┌────────────┐ ┌───────┐ │    │ │ Name      18 │ │
│ ▢ Stock│ │ chart      │ │ low   │ │    │ │ SKU     Low  │ │
│        │ │            │ │       │ │    │ ├──────────────┤ │
│ ▢ Order│ └────────────┘ └───────┘ │    │ │ Name     233 │ │
│ ▢ Repo │ ┌──────────────────────┐ │    │ └──────────────┘ │
│        │ │ table                │ │    ├──────────────────┤
│ Owner  │ └──────────────────────┘ │    │ End of content   │
└────────┴──────────────────────────┘    └──────────────────┘
```

- **Sidebar:** 216 px, sticky, with an icon and a word for each item, and the User's name, Role and Log out at its foot. Below 800 px, show every permitted destination in a single-column grid between the home link and account strip, above the content. Links have full labels, a minimum 44 px height and 8 px gaps on an opaque White surface. Navigation scrolls with the page; there is no bottom overlay to obscure content or paging. The shell pads all four device safe areas.
- **Content:** 32 px side padding (12 px on a phone), up to 1280 px wide.
- **Spacing:** a 4 px base: 4, 8, 12, 16, 24, 32. Gaps between surfaces are 16 px.
- **Surfaces:** white, a 1 px Line border, 8 px radius, no shadow, no gradient. Related figures share one surface, split by rules, rather than sitting in separate cards.
- **Radius by size:** surfaces and buttons 8 px, inputs and selects 6 px, badges fully round.
- **Tables:** 42 px rows at most for one line of text. A product row carries its SKU under the name. On a phone, drop secondary columns; stock and its state stay.
- **Stock movements:** reserve at least 192 px each for Product and Note on desktop and share spare width between them. Long names and notes wrap inside bounded cells; when seven columns cannot fit, scroll the table horizontally inside its surface. On phones, show the complete note beneath the movement; the grid's product column may shrink without pushing the page sideways.
- **Controls:** 38 px tall on a desktop, 44 px on a phone. shadcn's sizes are smaller, so set them when a screen first uses the component.
- **Dates:** independent labelled calendar triggers, 208 px desktop width and full width on phones, with persistent From/To labels. Empty controls say "Start date" / "End date"; a selected date appears once inside its trigger as `5 Nov 2026`. No Today, Clear or replacement removal buttons. Activating the selected day again removes that optional bound; the open calendar explains "Select the selected day again to remove it". Open on the selected day or Bangkok today, with visible focus, month arrows and Previous year / Next year buttons. Escape dismisses without changes; choosing/removing closes and restores focus. Calendar day targets are 44 px on phones, 40 px on desktop; seven columns fit inside the viewport. Use existing Forest/Ink/Moss tokens and the 4 px spacing rhythm. History shows "Leave dates empty for all history"; Reports explains that empty To means Bangkok today and empty From means the first day of effective To's month, shows the full-year effective range through loading/errors, and labels successful figures' returned range separately. Defaults stay out of explicit controls and URL state; "This month so far" resets the Reports range. Shop dates stay Bangkok dates in every device zone. (date-controls R1-R10)
- **Forms:** one column, up to 640 px wide, on a surface. Labels sit above their fields, and errors below them.
- **Login and Set password:** the screens without a sidebar, because nobody is logged in: a single 400 px surface, centered on Page.
- **This page didn't open:** the same surface, with Try again, when the check for a session fails with anything but a 401.
- **Page not found:** inside the shell: a page title, one line, and a link to the landing page.
- **Breakpoints:** 800 px switches the sidebar and stacks two-column sections. Check at 375, 768, 1024 and 1440 px; no page scrolls sideways.
- **Focus:** a 2 px Forest outline, offset 2 px, on everything that takes focus. shadcn's default `ring/50` alone falls below 3:1 on Page, so it needs the solid border beside it.
- **Motion:** 150 ms on hover and focus, nothing that plays by itself, and none under `prefers-reduced-motion`.
- **Brand:** `src/assets/stockflow.svg` is the original StockFlow mark: an outlined inventory carton with a rising outbound arrow, white on a Forest rounded square. The 32-unit drawing uses 2-unit strokes for readability at 16 px (favicon) and 32 px (shell). Keep the artwork square and beside the StockFlow wordmark. The pair is one link named "StockFlow home", leading Owner/Admin to Dashboard and Staff to Orders. It appears above navigation on desktop and above the account strip on phones. The favicon uses the same SVG.
- **Navigation:** main navigation contains destinations, with creation actions in their lists. Product forms select Products; Order forms and details select Orders; User forms select Users. Receive stock and Adjust stock have separate pages with Stock movements as their parent and selected main destination. Access to forms is independent of shortcut visibility. A white top bar above the work shows the current page; nested pages show a parent-list link, a quiet slash and the current page label. Parent links have 44 px touch height on phones. Unknown addresses say "Page not found"; denied addresses say "No access". Labels wrap when space is tight. Preserve the Forest palette, Figtree type and 4 px spacing rhythm.
- **Icons:** Lucide, 16 to 18 px, always beside a word unless the control has an accessible name.

## Principles

- **Stock is the one bold thing.** The count is the heaviest figure in its row, and beside it a level bar shows where stock stands against its threshold, once the record defines one. The rest of the screen stays quiet.
- **One accent.** Forest marks what can be acted on or what is selected. Amber and red appear only for stock or actions that need attention.
- **Say it in words too.** Every state has text, so it survives color blindness, a bad screen and a phone.
- **Rules, not boxes.** Prefer a line between rows to another card around them. Nothing is decorated: no shadows, gradients, capitals, numbered markers or eyebrow labels.
- **Density serves reading.** Tables stay compact on a desktop; a row is never so tight that its text is hard to read.

## Voice

Plain and direct, like a good colleague at the stock desk. English only (ADR 0009).

Every example below shows wording only. None of them says what the product does: which actions, states and limits exist is the record's to decide, and a screen uses these patterns for whatever the record states.

- **Naming:** use the glossary's terms once `stock-flow-context` has them, and until then the words people use at work: products, stock, orders. Roles are Owner, Admin and Staff.
- **Case:** sentence case everywhere, including buttons and table headers.
- **Buttons:** a verb and its object: "New order", "Add product", "Receive stock". Never "Submit" or "OK".
- **Same word through the flow:** "Add product" leads to "Product added", and "Cancel order" to "Order cancelled".
- **Stock states:** "Low", "Out of stock". Counts against a minimum read "18 of 60".
- **Errors:** say what happened and how to fix it, without apology: "Only 18 in stock. Lower the quantity to continue." Show them beside the field. Messages map from the API's error codes (`AGENTS.md`, *The API contract*).
- **Empty states:** say what belongs here and offer the action: "No products yet. Add your first product to start tracking stock."
- **Confirmations:** name the thing and the consequence: "Delete Safety helmet? This can't be undone."
- **Numbers:** `฿48,210` with thousands separators, dates as `5 Nov`, times as `14:12`.

## Screens

One row per frame in `design/frames/`. A ticket's `Design:` line names rows here. There are no frames: the direction wasn't drawn in Figma, so screens follow the sections above.

| Screen | Image | Figma frame | Exported |
| --- | --- | --- | --- |

## List paging

Navigation & lists R4-R7: place paging directly below the list, including short or empty lists. Follow the shadcn/ui Tasks table footer pattern: muted position text on the left, with the native rows-per-page select and outline icon buttons grouped on the right. Use Lucide first, previous, next and last chevrons with accessible names and hover titles. Keep all four buttons together when wrapping, with 12 px gaps; on narrow screens the controls occupy a full-width row and the selector may wrap separately. Retain the 44 px phone targets, 38 px desktop controls and visible keyboard focus.

Products, Orders and Users show "Page n of m" and the matching count, with First page, Previous page, Next page and Last page always visible. Unavailable directions are disabled. Rows per page offers 10, 25 (default), and 50. URL state retains filters and size; changing either resets the page. Out-of-range pages explain the missing page and offer First page without discarding filters. Loading and error states keep controls visible; First page remains available for recovery.

Histories show Viewing newest entries or Viewing older entries with Newest entries and Older entries, never totals or numbered pages. An empty older page offers return to newest. Reports uses the same numbered controls at 25 daily rows; the chart and totals describe the full range. Dashboard and Top products stay bounded as before.

## Date-control inventory (#43)

Audited source and browser tests for native date inputs, date picker components and Today/Clear actions. The shared `DateInput` has four usages: Stock movements From/To and Reports From/To. All use the adopted calendar; no other picker or HTML date input remains. Dashboard/chart days, table dates, creation/completion timestamps and Login log times are read-only displays, excluded from picker interactions. Whole-page Clear filters and Reports' This month so far remain range/filter resets.
