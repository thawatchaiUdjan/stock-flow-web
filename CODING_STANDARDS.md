# Coding standards

`code-review` checks every change against this file (its Standards axis), on top of a fixed baseline of code smells. A rule written here overrides that baseline. Skip anything a tool already enforces; name the tool instead.

## Formatting and linting

oxfmt formats and oxlint lints (ADR 0010): `bun run format` and `bun run lint`. CI fails on either, so don't restate their rules here.

## Naming

- Domain concepts use the terms in local `GLOSSARY.md`, never their `_Avoid_` synonyms.

## Structure

- Each page is a route file in `src/routes/`, with its test beside it as `<route>.test.tsx`.
- `src/components/ui/` is shadcn's; other shared components sit in `src/components/`.
- `src/api/generated/` and `src/routeTree.gen.ts` are generated: never edit them.
- Components call the API only through generated hooks, in routes or components.
- Server state stays in Query, filters in URL search params, the rest in local state (ADR 0008).
- Handlers in `src/mocks/` pin what the real API sends; never leave Orval's random mock data in one.

## Design tokens

- Colors, type and spacing come from tokens that implement `docs/design.md`; no one-off values in a component.

## API access

- Calls go through the generated client only; no hand-written request for an operation the contract describes.
- An error shown to the user comes from the error-code mapping, never from the raw server message.

## Comments

- One short line, only where the reason isn't obvious from the code; never narrate what the code does.
- Code that enforces a recorded rule cites it: `<module> R3` or `domain ADR 0007`. Historical `context ADR NNNN` citations resolve to the imported business decisions in `docs/domain/adr/`.

## Tests

- Tests drive the UI the way a user does and assert what the user sees and what was sent, not component internals.
- Assert the actual value, not just that something rendered.
- A test is never weakened, skipped or deleted to get green; challenge it explicitly instead.
