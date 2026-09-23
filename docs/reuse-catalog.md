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
- Mirror a workflow skill byte-identically into `.agents/skills/<skill>/`, and let its contract test assert the mirror matches.
- Keep each `tests/*.test.mjs` file self-contained, defining its file helpers (`fileExists`, `parseFrontmatter`) locally.
- List skills through `discoverSkills` rather than walking `skills/` by hand.

## Shared

### Skill discovery and index

- `discoverSkills` — `scripts/generate-skill-index.mjs` — use for: listing every skill with its category, directory, and frontmatter
- `renderIndex` — `scripts/generate-skill-index.mjs` — use for: rendering the Skill Index markdown from discovered skills
- `generateIndex` — `scripts/generate-skill-index.mjs` — use for: writing `docs/skills/README.md` (the `npm run docs:index` entry point)

## Candidates

## Coverage

- `scripts/` — surveyed 2026-09-23
- `tests/` — surveyed 2026-09-23
- `skills/agents/` — surveyed 2026-09-23
