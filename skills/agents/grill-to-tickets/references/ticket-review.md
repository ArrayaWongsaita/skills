# Ticket Review Brief

Give this brief to one fresh reviewer for the whole ticket set.

## Reviewer

**Paths:** Read every ticket under `.scratch/<feature-slug>/issues/`, the
`.scratch/<feature-slug>/spec.md`, every file named in the tickets' `**Context:**`
lines, the feature glossary at `.scratch/<feature-slug>/CONTEXT.md`, the feature
ADRs under `.scratch/<feature-slug>/adr/`, the repository glossary at
`docs/glossary.md`, and the repository ADRs under `docs/decisions/`.

**Task:** For each ticket, decide whether a fresh worker holding only that
ticket and what its Context line lists could start without asking anyone. Trace
each Context path. The glossary, ADRs, and spec text outside the Context-named
sections serve only to understand terms; they supply no information to fill a
gap the worker could not resolve from its ticket and Context paths.

**Return:** One line per ticket, numbered as in the ticket set. Use exactly one
of these forms: `NN READY` or `NN ASK: <question>`.

```text
NN READY
NN ASK: <question>
```

Use exactly the verdicts `READY` or `ASK`. An `ASK` carries the question a
fresh worker would have to ask before starting. A ticket with no line in the
return is treated as `ASK` with the question `the reviewer returned no verdict`.

The review reads for ambiguity only and sets no limit. This is the ambiguity-only form of the
readiness dry-run that ADR 0014 deferred. The reviewer edits nothing.
