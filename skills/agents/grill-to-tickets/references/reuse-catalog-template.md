# Reuse Catalog template

The bootstrap template for a project's `docs/reuse-catalog.md`. When the Stage 0
Reuse survey finds no catalog, create `docs/reuse-catalog.md` from the block
below, fill it from the survey, and keep only the Shared category headings that
received an entry.

The header comment makes the file self-describing: every skill that later reads
or writes the catalog follows the header, not a copy of these rules.

```markdown
# Reuse Catalog

<!--
Maintained by agents; humans may edit it too. It indexes this project's
reusable code so agents build on it instead of re-deriving it.

Invariant: every line describes code that exists now. A module a feature only
plans to build stays in that feature's spec until the ticket that creates it is
integrated.

Entry (one line; the symbol is the bare identifier as written in code):
  - `symbol` — `path/to/file` — use for: <when to reach for it>
Candidate entries add where they came from:
  - `symbol` — `path/to/file` — use for: <when> · from: <feature-slug or area>

Writers:
  - a Reuse survey (grill-to-tickets Stage 0): bootstrap, drift repair, entries
    for existing modules found in a gap, Coverage dates;
  - an implementer at integration: entries for modules a ticket created,
    extended, or promoted, in that ticket's own commit.
Readers confirm an entry's symbol is still in its file before relying on it.

Coverage: one line per surveyed area with the date of its last survey. Only a
survey moves a date. To refresh an area, re-read the files still present in
  git log --since=<date> --first-parent --diff-merges=first-parent --name-only --format= -- <area>
An area missing from Coverage has never been surveyed.

When this file outgrows a single read, split it by area into
docs/reuse-catalog/<area>.md and keep this file as the map.
-->

## Where shared code lives

- <kind of module>: `<directory>/`

## Rules

- <the thing to use for a recurring need, phrased as what to do>

## Shared

### Formatting

### Data access

### UI

### Validation

### State and hooks

### Test helpers

## Candidates

## Coverage

- `<area>/` — surveyed <YYYY-MM-DD>
```

A Rule records a convention the survey found the codebase following
consistently — "Call HTTP through `apiClient`", "Build test users with
`makeUser`" — so `review-to-pr` can later hold new code to it.
