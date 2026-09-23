# Reuse Catalog + Reuse Pass — Specification

Feature slug: `reuse-catalog`. Glossary: [CONTEXT.md](CONTEXT.md). Decisions:
[adr/0001](adr/0001-catalog-lists-only-existing-code.md),
[adr/0002](adr/0002-orchestrator-writes-catalog-from-text.md),
[adr/0003](adr/0003-coverage-by-survey-date.md),
[adr/0004](adr/0004-design-for-extraction.md),
[adr/0005](adr/0005-reuse-field-not-acceptance-criterion.md). Repo ADR (to be
written in ticket 01): `docs/decisions/0008-reuse-catalog-cross-skill-contract.md`.
Unchanged constraint: [docs/decisions/0003](../../docs/decisions/0003-grill-to-tickets-standalone-composite.md)
— no `mattpocock/skills`- or `thananon/9arm-skills`-sourced file is edited.

## Problem Statement

Code built through `grill-to-tickets` → `subagent-implement` / `agy-implement` /
`opencode-implement` comes out full of duplication: a new date formatter next to
the existing one, a second table component, the same filter logic written once
per ticket. It is not the agents being careless — the pipeline structurally
hides existing code from whoever writes the code:

1. `grill-to-tickets` Stage 0 grounds itself in `CONTEXT.md`, ADRs, and
   `.scratch/`, but never surveys the code for reusable modules.
2. `to-spec` forbids file paths, and `to-tickets` marks codebase exploration and
   prefactoring *optional*, so nothing about "this already exists" is written
   into the spec or the tickets.
3. Every implementer's worker prompt says "read only the files listed above …
   skip scanning the repository", and passes only "What to build", the
   acceptance criteria, spec sections, ADRs, glossary, and a test seam. A worker
   has no way to learn a helper exists. In parallel waves, two tickets needing
   the same helper each write their own in separate worktrees.
4. `code-review`'s Duplicated Code smell compares hunks *within the change*, so a
   new helper that duplicates an existing one outside the diff passes review.

And every fix that relies on "search the codebase first" pays the full survey
cost on every run, because nothing remembers what the last run found.

## Solution

A persistent, per-project **Reuse Catalog** (`docs/reuse-catalog.md`) plus a
**reuse pass** threaded through the existing stages — not a new stage — with
three layers: **prevent** at planning, **guide** at implementation, **detect** at
review.

- **Plan (`grill-to-tickets`).**
  - *Stage 0 — Reuse survey.* Read the catalog, drift-check it, and survey only
    the gaps (uncovered areas the idea touches; files changed in covered areas
    since their Coverage date). Bootstrap the catalog if absent. Record facts;
    turn genuine reuse choices ("extend `DataTable` or build a new table?") into
    grilling questions with a recommended answer.
  - *Stage 1 — Reuse Plan.* The spec gains a Reuse Plan under Implementation
    Decisions: use / extend / create-shared (with interface + named consumers) /
    create-candidate / promote / kept separate on purpose.
  - *Stage 2 — reuse lens.* The Design Review Gate checks the Reuse Plan against
    the catalog: duplicated existing module, shared logic with no owner,
    speculative shared module.
  - *Stage 3 — owner tickets.* Each new shared module gets exactly one owner
    ticket; consumers are blocked by it; every ticket carries a `**Reuse:**`
    line.
  - *Handoff* points at the catalog-aware directory implementers and reminds the
    user to commit the planning artifacts and catalog changes first.
- **Implement (the three directory implementers).** The worker prompt carries
  the ticket's Reuse line verbatim and permits a catalog lookup before creating
  any unplanned helper. At integration, the orchestrator writes catalog entries
  for the ticket's non-`use` reuse verbs in the ticket's own squash commit.
- **Review (`review-to-pr`).** The catalog is passed to `code-review` as a
  documented standards source, so an unplanned duplicate of a catalogued module
  is a documented-standard violation on the Standards axis.

## User Stories

1. As a developer, I want the planner to know which helpers, components, hooks,
   clients, schemas, and test factories my project already has, so that the spec
   builds on them instead of re-inventing them.
2. As a developer, I want that knowledge stored in one file in my repo, so that
   agents do not re-read the whole codebase on every run.
3. As a developer, I want the catalog to record which areas have been surveyed
   and when, so that an agent re-reads only what changed and never mistakes a
   partial catalog for a complete one.
4. As a developer, I want every catalog read to verify that each entry still
   exists, so that a stale entry never sends an agent to deleted code.
5. As a developer, I want the catalog created automatically the first time I run
   `/grill-to-tickets` in a project, covering the area that run surveyed, so that
   I do not have to write it by hand up front.
6. As a developer, I want a one-line pointer to the catalog in my `AGENTS.md`
   (or `CLAUDE.md`), so that any agent — not only these skills — can find it.
7. As a developer, I want genuine reuse trade-offs put to me as grilling
   questions with a recommendation, so that I make the extend-vs-new calls and
   the agent only finds facts.
8. As a developer, I want the spec to state, per module, whether it is used
   as-is, extended, newly shared, a candidate, promoted, or kept separate on
   purpose, so that the design's reuse decisions are explicit and reviewable.
9. As a developer, I want a new shared module's interface settled in the spec,
   covering every named consumer, so that the owner ticket builds what all
   consumers need and no consumer writes its own variant.
10. As a developer, I want a module promoted to shared only when it has two real
    consumers (or I confirm a named upcoming consumer), so that the agent does
    not build speculative general-purpose abstractions.
11. As a developer, I want single-consumer modules with a feature-agnostic
    interface recorded as candidates, so that a later feature can find and
    promote them.
12. As a developer, I want look-alike code that changes for different reasons
    recorded as "kept separate on purpose", so that the review does not force a
    wrong abstraction.
13. As a developer, I want the Design Review Gate to flag a spec that
    re-creates a catalogued module, leaves shared logic without an owner, or
    shares a module with fewer than two consumers, so that reuse mistakes are
    caught before tickets exist.
14. As a developer, I want each new shared module owned by exactly one ticket and
    every consumer blocked by it, so that parallel waves cannot produce two
    copies.
15. As a developer, I want each ticket to carry a Reuse line with fixed verbs, so
    that the worker and the orchestrator read the same instructions.
16. As a developer, I want reuse guidance kept out of acceptance criteria, so
    that tickets do not fail the one-test-per-criterion verification gate.
17. As a developer, I want the worker prompt to include the Reuse line and allow a
    catalog lookup before creating any helper, so that a worker can reuse code
    without scanning the repository.
18. As a developer, I want the implementer to add catalog entries for modules a
    ticket creates, extends, or promotes, in that ticket's own commit, so that
    the catalog stays current without a separate step or merge conflicts.
19. As a developer, I want the orchestrator to write those entries without
    reading code, so that the implementers' context-preservation design holds.
20. As a developer, I want `review-to-pr` to treat the catalog as a coding
    standard, so that an unplanned duplicate that slipped through is a blocker
    I see before the PR.
21. As a developer, I want a missed catalog update to be picked up by the next
    Reuse survey, so that using an implementer that is not catalog-aware
    degrades gracefully instead of corrupting the catalog.
22. As a developer, I want the handoff to name the catalog-aware implementers
    and remind me to commit first, so that the implementer's clean-tree preflight
    does not stop on the planning files.
23. As a developer running an implementer in a project with no catalog, I want
    catalog steps skipped silently, so that the implementers keep working
    exactly as before.

## Implementation Decisions

### The catalog file — `docs/reuse-catalog.md`

Self-describing: its header states the invariant, the entry format, who writes
it, and how Coverage works, so every skill that writes it follows the file
rather than carrying its own copy of the format. Only `grill-to-tickets` holds
the template (`references/reuse-catalog-template.md`), used for bootstrap. Shape
(from the design discussion; the template is the source of truth once written):

```markdown
# Reuse Catalog

<!-- Maintained by agents. Lists only code that exists now.
Entry: - `symbol` — `path` — use for: <when>
Candidates add: · from: <feature-slug>
Writers: grill-to-tickets Reuse survey (bootstrap, drift repair, gap findings);
implementers at integration (create-shared / create-candidate / extend / promote).
Coverage: only a survey moves an area's date. Re-survey = files changed since it.
Split by area into a map when this file outgrows one read. -->

## Where shared code lives
- helpers: `src/lib/` · UI primitives: `src/components/ui/` · test factories: `tests/factories/`

## Rules
- Format money with `formatCurrency`.
- Call HTTP through `apiClient` (auth + retry built in).

## Shared
### Formatting
- `formatCurrency` — `src/lib/money.ts` — use for: every price display

## Candidates
- `useReportFilters` — `src/features/reports/use-report-filters.ts` — use for: date-range + status filtering · from: report-export

## Coverage
- `src/lib/` — surveyed 2026-09-23
- `src/features/reports/` — surveyed 2026-09-23
```

An entry's symbol is the bare identifier as it appears in code (`DataTable`, not
`<DataTable>`), so the drift check and the integration step can grep it as-is.
Categories under Shared are free-form headings; the template seeds Formatting,
Data access, UI, Validation, State/hooks, Test helpers. Rules are phrased
positively (what to use), because `code-review` reads them as standards.

### `grill-to-tickets` — Stage 0 Reuse survey

- Runs after "Ground in existing context", before the first grilling round.
- **Read + drift check:** read `docs/reuse-catalog.md`; for every entry confirm
  the symbol exists in its file; correct or remove the ones that do not.
- **Gap survey** — read-only, delegated to an Explore-type subagent as a fact
  lookup (grilling's own rule; the stage itself stays on the main thread):
  - areas the idea touches that are not in Coverage → full survey of the area;
  - covered areas the idea touches → only files still present in
    `git log --since=<date> --first-parent --diff-merges=first-parent --name-only --format= -- <area>`.
  - Looks for: helpers, UI components, hooks, services/clients, validation
    schemas, types/constants, test factories/fixtures, and the house pattern for
    the kind of work (error handling, data fetching, forms).
- **Write back** (existing code only — ADR 0001): add entries for shared modules
  and candidates found in the gaps; set the surveyed areas' Coverage date to
  today. Bootstrap when the file is absent: create it from the template, fill it
  from this survey, and add a one-line pointer to `AGENTS.md` if it exists, else
  `CLAUDE.md` if it exists, else report in the Stage 0 summary that no
  instruction file was found.
- **Grill:** each genuine reuse choice becomes a frontier question with a
  recommended answer. Facts are not asked.
- The Stage 0 pause summary lists the catalog changes made.

### `grill-to-tickets` — Stage 1 Reuse Plan

`### Reuse Plan` under Implementation Decisions, names by symbol (greppable) and
never by path, preserving `to-spec`'s no-path rule:

- **Use as-is:** symbol → user stories.
- **Extend:** symbol + the interface change + whether existing callers change →
  stories.
- **Create shared:** name + interface (signature, invariants, error modes) +
  named consumers (≥2 stories, or 1 existing caller + 1 story, or a
  user-confirmed upcoming feature) + use-when.
- **Create candidate:** name + feature-agnostic interface + the plausible second
  use + use-when.
- **Promote:** candidate symbol + the new consumer → becomes a prefactor ticket.
- **Kept separate on purpose:** the look-alike pair + why they change for
  different reasons.

### `grill-to-tickets` — Stage 2 reuse lens

`scrutinize` runs with the Reuse Plan and the catalog as context; its mandatory
"use something that already exists" pass is pointed at them. The gate records
reuse findings with stable ids (`reuse-duplicate-<symbol>`,
`reuse-unowned-<shape>`, `reuse-speculative-<symbol>`). Routing:

- the spec creates what the catalog already has; logic needed by ≥2 stories has
  no create-shared; a create-shared has <2 consumers → `FIX_THEN_SHIP` (edit the
  Reuse Plan);
- extend-vs-new is a genuine trade-off nobody decided → `REWORK`, decision-level
  (return to Stage 0 for that one question).

Budget, stall, and verdict vocabulary are unchanged.

### `grill-to-tickets` — Stage 3 tickets

- Each create-shared module has exactly one **owner ticket**: the first vertical
  slice that consumes it. Its acceptance criteria include the module's behaviour
  at its interface (testable). Every other consumer lists the owner in
  `Blocked by`. No horizontal "utils" ticket.
- Each promote becomes a prefactor ticket that moves the candidate into the
  shared layer; the consuming ticket is blocked by it.
- Every ticket carries, after `Blocked by`:
  `` **Reuse:** use `a` · extend `b` (<change>) · create-shared `c` · create-candidate `d` · promote `e` ``
  — or `**Reuse:** none`. Verbs are fixed; symbols in backticks.
- Before the quiz: check each create-shared has one owner, each consumer is
  blocked by it, and no reuse statement sits in acceptance criteria.

### `grill-to-tickets` — handoff

Replace the single-ticket `/implement` line with the directory implementers,
`/subagent-implement .scratch/<feature-slug>/` first, `agy-implement` /
`opencode-implement` as alternatives, and a line to commit `.scratch/<slug>/`
plus any `docs/reuse-catalog.md` / instruction-file change before running one
(their preflight requires a clean tree). Docs (`docs/guides/grill-to-tickets.md`,
`docs/skills/agents/grill-to-tickets.md`) are aligned to it.

### Implementers (`subagent-implement` establishes; `agy-implement`, `opencode-implement` mirror)

- **Prompt scaffold, "Context you need":** add
  `- Reuse: <the ticket's Reuse line, verbatim>` and
  `- Reuse Catalog: <abs path to docs/reuse-catalog.md> — read-only for you; before creating any helper, component, or test factory not named in Reuse, search it for an existing one`
  (the catalog line only when the file exists). The "read only the files listed
  above" constraint then covers both lines' targets. The Return contract is
  unchanged. In `opencode-implement` the fallback subagent receives the same
  scaffold, so it inherits this with no separate change.
- **Spec sections for the worker:** when the Reuse line carries any verb other
  than `use`, the orchestrator adds the spec's Reuse Plan to the worker's named
  sections, so the owner ticket builds the interface the Reuse Plan settled for
  every consumer rather than one tailored to itself.
- **Integration step:** in the ticket's squash-merge commit, for each
  `create-shared` / `create-candidate` / `promote` / `extend` verb: grep the
  symbol in the worker's changed files to get the path (skip and record in the
  status file if not found — never write an entry for code that is not there);
  take use-when from the spec's Reuse Plan; add or update the line under Shared
  or Candidates (promote moves it from Candidates to Shared). No catalog file →
  skip silently. Coverage dates are untouched. The orchestrator is the catalog's
  only writer during a run; workers read it.
- Planning (Stage 0 of each implementer) is unchanged — the Reuse line needs no
  parsing before integration.

### `review-to-pr`

In the inline `code-review` call, name `docs/reuse-catalog.md` (when present) as
a documented standards source alongside whatever the repo documents, with the
brief: a new module that duplicates a catalogued one, or code that bypasses a
catalog Rule, is a documented-standard violation — cite the catalog line. The
existing normalization then makes it a blocker when it has a concrete
consequence (two implementations that can diverge). No other change.

### Repo-level record

`docs/decisions/0008-reuse-catalog-cross-skill-contract.md` records the
cross-skill contract: the catalog path, the invariant, the Reuse field verbs,
and which skill writes what. `docs/glossary.md` gains Reuse Catalog and Reuse
field.

## Testing Decisions

- The repo's quality gate is `npm test` (Node contract/eval-shape tests +
  instruction-tool tests) and `npm run validate`. Every ticket ends green on
  both.
- **Contract tests** (`tests/<skill>-contract.test.mjs`) assert presence of the
  new behaviour in the skill text, following prior art: grill-to-tickets
  asserts the Reuse survey (drift check, Coverage, bootstrap, pointer), the
  Reuse Plan categories, the gate's reuse routing, the owner-ticket rule, the
  Reuse field verbs, the "not an acceptance criterion" rule, and the new
  handoff; each implementer asserts the scaffold's Reuse and catalog lines and
  the integration-step catalog update; review-to-pr asserts the standards-source
  line. The canonical/`.agents` mirror byte-identity tests keep covering every
  changed file.
- **Positive steering** is already enforced (no "Never"/"Do not" in
  `SKILL.md` bodies); new text is written to pass it.
- **Eval cases** (`evals/evals.json`) are behavioural documentation in
  skill-creator format, as today. `tests/grill-to-tickets-evals.test.mjs`
  currently pins exactly 7 cases; it changes to "at least one case per routing
  branch, plus the reuse cases".
- Prior art: `tests/grill-to-tickets-contract.test.mjs`,
  `tests/subagent-implement-contract.test.mjs`,
  `tests/review-to-pr-evals.test.mjs`.

## Out of Scope

- Editing any upstream-sourced skill (`to-spec`, `to-tickets`, `scrutinize`,
  `code-review`, `implement`, `grill-with-docs`, …) — ADR 0003 stands.
- Making upstream `/implement` catalog-aware; its runs self-heal through the next
  survey instead.
- A generator script or CI drift check for the catalog in target projects.
- Mechanical clone detection (jscpd and similar) in the verification gate.
- The other review items from the design discussion: a Stage 0 frontier
  checklist (data/migration, error/empty/loading, permissions, performance,
  compatibility), story → ticket traceability, and an explicit "`.scratch/`
  replaces the tracker" line for inline `to-spec` / `to-tickets`. Recorded as
  follow-ups.

## Further Notes

- The survey command errs toward re-reading: deleted files are dropped from its
  output; rebased or same-day commits reappear harmlessly.
- Monorepos keep one catalog with Coverage per package path until it outgrows a
  single read, then split by area with the root file as a map — mirroring
  `CONTEXT-MAP.md`.
