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

- Repository tooling (skill discovery, Skill Index generation, validation): `scripts/`

## Rules

- Give each skill its own copy of any reference material it needs, so every skill installs and runs on its own (ADRs 0003–0008).
- Keep `skills/` as the only tracked copy of a skill; `.agents/` and `.claude/skills/` are local install output (ADR 0011), so a contract test reads `skills/` only.
- Keep each `tests/*.test.mjs` file self-contained, defining its file helpers (`fileExists`, `parseFrontmatter`) locally.
- List skills through `discoverSkills` rather than walking `skills/` by hand.
- Assert skill wording in contract tests with `assert.match` against a sliced section (`content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"))`), not the whole file.
- Give every planning safeguard its own eval case, named so the skill's `*-evals.test.mjs` safeguard regex list finds it.
- Keep a prose block the three implementers share word for word by registering it in `SHARED_BLOCKS` of `tests/implementer-reuse-drift.test.mjs`.

## Shared

### Skill discovery and index

- `discoverSkills` — `scripts/generate-skill-index.mjs` — use for: listing every skill with its category, directory, and frontmatter
- `renderIndex` — `scripts/generate-skill-index.mjs` — use for: rendering the Skill Index markdown from discovered skills
- `generateIndex` — `scripts/generate-skill-index.mjs` — use for: writing `docs/skills/README.md` (the `npm run docs:index` entry point)

## Candidates

- `parseTicket` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: reading any `**Name:** value` field from a local ticket file · from: grill-to-tickets
- `checkFeature` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: mechanical checks over a feature's spec and tickets (errors, notes, story coverage, blocker sets, budgets) · from: grill-to-tickets
- `estimateTokens` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: estimating the tokens of a text · from: grill-to-tickets-production
- `checkFeatureDir` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: running the checks over a feature directory (project root, Context files, optional Budget writing) · from: grill-to-tickets-production
- `formatReport` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: rendering the checker's text report (errors, story coverage, budget table, notes, result) · from: grill-to-tickets-production
- `sectionOf` — `skills/agents/grill-to-tickets/scripts/check-tickets.mjs` — use for: reading one section of a markdown document by heading · from: grill-to-tickets-production
- `extractBlock` — `tests/implementer-reuse-drift.test.mjs` — use for: slicing a start/end-delimited prose block out of a reference file to compare across skills · from: tests

## Coverage

- `scripts/` — surveyed 2026-09-23
- `tests/` — surveyed 2026-09-24
- `skills/agents/` — surveyed 2026-09-24
