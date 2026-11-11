# Domain docs

This repository owns its frontend domain record. `stock-flow-context` is historical reference only. No sibling checkout is required.

## Read before exploring

- `GLOSSARY.md`: canonical domain vocabulary.
- `docs/requirements/<module>.md`: applicable rules and open questions.
- `docs/domain/adr/`: business decisions, including the imported shared baseline.
- `docs/adr/`: frontend technical decisions.

Do not infer a business rule from backend code or a ticket summary. If a needed rule is missing, resolve it locally with `/grill-with-docs`, or record it under the module's Open questions. If code, requirements and the accepted API contract disagree, surface that conflict before changing the affected behaviour.

## Writing the record

`/grill-with-docs` combines `grilling` and `domain-modeling`. In this repository it also writes settled behaviour to `docs/requirements/<module>.md`, using `docs/requirements/README.md`. Keep rule IDs stable; never renumber them. Unknowns are questions, not rules. Preserve existing confirmed rules until their change is authorised and recorded.

New terms go in root `GLOSSARY.md` using the installed `domain-modeling/GLOSSARY-FORMAT.md`: a term, its definition and avoided synonyms. The glossary contains vocabulary, not implementation details or a substitute for requirements.

Business ADRs go in `docs/domain/adr/`, overriding `domain-modeling`'s default path. A business decision describes behaviour that would survive a rewrite in a different stack. Technical ADRs go in `docs/adr/`. Number each directory independently by incrementing its highest existing number. Offer an ADR only for a significant trade-off that is hard to reverse and surprising without context; ordinary new rules belong in requirements.

Technical ADR format:

```md
# NNNN: <Short title>

Status: Proposed | Accepted | Superseded by ADR NNNN
Date: YYYY-MM-DD

## What it is for
## Why it was chosen
## What was not chosen and why
```

Business ADR format:

```md
# NNNN: <Short title>

Status: Proposed | Accepted | Superseded by domain ADR NNNN
Date: YYYY-MM-DD
Affects: web | api, web (requires direct coordination)

## Context
## Decision
## Consequences
## Alternatives considered
```

Accepted, merged decisions are immutable. Change course with a new ADR identifying the superseded decision; only its Status line may be updated. Imported decisions retain their historical meaning. Workflow ownership is explicitly superseded by technical ADR 0023; this does not revoke product rules.

## Citations and scope

Use `<module> R3`, `domain ADR 0007` and `technical ADR 0007` to distinguish the two decision directories. Existing `context ADR NNNN` citations resolve to the same-numbered imported decision in `docs/domain/adr/`. Existing unqualified frontend technical citations retain their meaning. Migration provenance: `docs/domain/README.md`.

Use the glossary's terms in code, tests, requirements and tickets. If a proposed change affects backend guarantees, record the request here and coordinate directly with the API repository under `docs/workflow.md`. Local documentation never changes another repository's behaviour by itself.
