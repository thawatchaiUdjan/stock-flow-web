# Design files

The files `docs/design.md` is written from, when the design comes from Figma. Agents read these exports; they don't read Figma itself (until a Figma MCP server is set up, and even then the exports stay the record).

```
docs/design/
├── variables/<collection>.json   Figma Variables, exported (or tokens.md, when the file has none)
└── frames/<screen>.png           one image per screen (or screen state), 2x
```

`<screen>` is a short slug (`order-list`, `order-list-empty`, `booking-form-error`), the same one used in `docs/design.md`'s *Screens* table and in each ticket's `Design:` line.

## In Figma: what to prepare

1. **Variables** for every color, type size, spacing and radius, rather than loose fills and sizes, so they can be exported.
2. **One frame per screen**, and one per state that looks different (empty, error, loading, a form with a validation error). Name each frame with its slug.
3. Where possible, build from the Figma UI kit of the component library chosen with the stack, so frames and code share components.

## Exporting (free plan, no MCP)

- **Variables:** click the **Variables** tab in the left navigation bar. Right-click a collection → **Export modes** (or a single mode → **Export mode**), and save the JSON as `variables/<collection>.json`. Figma doesn't document the JSON's format; the first export shows it.
- **No Variables in the file** (the Variables view lists no collection): the values still come as text, never guessed from an image. Select a whole frame: the right sidebar's **Selection colors** lists every color in it as a hex value. Click a text layer for its font, size, weight and line height. If the file has color or text styles, their values are listed the same way. Write them into `variables/tokens.md` (name, value, where it's used), or save screenshots of those panels where the values are readable; the agent drafts the tokens from them and the requirements owner confirms each value in the pull request. Turning them into Figma Variables later makes the next export one click.
- **Frames:** select the frame → *Export* in the right sidebar → PNG, 2x → Export, and save it as `frames/<screen>.png`. Re-exporting a changed frame overwrites the same file.

Then say "update the design from Figma". The agent compares the exports with `docs/design.md`, writes the changes there, and opens one pull request.

## When the design changes

| What changed in Figma | What happens |
| --- | --- |
| A token: a color, type size, spacing, radius | Re-export the variables. One pull request updates `docs/design.md` and the token code, and lists every screen whose look changes ✋ |
| The frame of a screen not built yet | Re-export its image under the same name; `docs/design.md` gets the new export date. Its ticket picks it up when built |
| The look of a screen already built | Re-export its image. The same pull request updates that screen's code to match ✋ |
| What a screen does: a field, a step, a rule | **Not a design change: a requirement change.** It goes through `/grill-with-docs` and a record pull request first; the frame then follows the record |

A frame is never the source of a rule. When a frame shows behaviour the record doesn't state, that is an open question for the record, not something to build.
