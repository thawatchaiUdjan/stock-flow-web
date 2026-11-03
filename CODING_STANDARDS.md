# Coding standards

`code-review` checks every change against this file (its Standards axis), on top of a fixed baseline of code smells. A rule written here overrides that baseline. Skip anything a tool already enforces; name the tool instead.

<!-- FILL: complete the sections below when the stack is chosen. Leave a section out rather than writing a rule nobody follows. -->

## Formatting and linting

<!-- FILL: the formatter and linter, and the command that runs them. -->

## Naming

- Domain concepts use the terms in `template-context`'s `GLOSSARY.md`, never their `_Avoid_` synonyms.

## Structure

<!-- FILL: how pages, components and state are laid out, and where API calls are allowed to happen. -->

## Design tokens

- Colors, type and spacing come from tokens that implement `docs/design.md`; no one-off values in a component.

## API access

- Calls go through the generated client only; no hand-written request for an operation the contract describes.
- An error shown to the user comes from the error-code mapping, never from the raw server message.

## Comments

- A comment states *why*, or the constraint the code obeys, never *what* the next line does.
- Code that enforces a recorded rule cites it: `<module> R3` or `context ADR 0007`.

## Tests

- Tests drive the UI the way a user does and assert what the user sees and what was sent, not component internals.
- Assert the actual value, not just that something rendered.
- A test is never weakened, skipped or deleted to get green; challenge it explicitly instead.
