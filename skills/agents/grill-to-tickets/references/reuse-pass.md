# Reuse pass

Reuse is designed during planning, where every ticket is visible at once and
the user is present to decide trade-offs. Implementation only follows the plan.
This reference holds the reuse rules for each stage.

**The Reuse Catalog** is the target project's `docs/reuse-catalog.md`: where
shared code lives, the rules for using it, one entry per shared module, the
candidates, and the survey Coverage. It lists only code that exists now — a
module this feature plans to build belongs in the spec, and enters the catalog
when the ticket that creates it is integrated. Bootstrap template:
[reuse-catalog-template.md](reuse-catalog-template.md).

## Stage 0 — Reuse survey

Run after grounding in existing context, before the first grilling round.

### 1. Read and drift-check

Read `docs/reuse-catalog.md` when it exists (absent → step 4 bootstraps it).
For every entry, grep its bare symbol in its file. An entry whose file is gone,
or whose file no longer contains the symbol, is corrected — grep the symbol
across the repository for its new file — or removed when the symbol is gone.
Record each correction and removal for the Stage 0 summary.

### 2. Decide the gaps

List the areas (directories or packages) the idea touches, plus the locations
under "Where shared code lives". For each area:

- **not in Coverage** → survey the whole area;
- **in Coverage** → re-read only the files still present in
  `git log --since=<date> --first-parent --diff-merges=first-parent --name-only --format= -- <area>`;
  an empty result means nothing to read there.

The gap list is the whole survey: covered, unchanged files stay unread, because
the catalog already holds what they contain.

### 3. Survey the gaps

Dispatch one read-only Explore-type subagent with the gap list. This is a fact
lookup; the stage itself stays on the main thread. Brief it to return, per
reusable module found:

- the bare symbol, its file, and a one-line use-when;
- **shared** when it sits in a shared location or already has two or more
  callers, **candidate** when it has one caller but a feature-agnostic interface;
- skip feature-internal code whose interface names the feature's own types.

Look for helpers and utilities, UI components, hooks and state, services and API
clients, validation schemas, types, constants and enums, and test factories,
fixtures, and builders. Also return the **house pattern** the idea's kind of work
follows — how the codebase already handles errors, fetches data, builds forms,
and so on — noting where it is followed consistently.

### 4. Write back

Write only facts about code that exists:

- add an entry for each finding under Shared (by category) or Candidates;
- add a Rule for each house pattern the codebase follows consistently, phrased
  as the thing to do;
- set the Coverage date of every area surveyed in step 3 to today.

**Bootstrap** when the file is absent: create `docs/reuse-catalog.md` from the
template, fill it from this survey, and add one pointer line to the project's
instruction file — `AGENTS.md` when it exists, else `CLAUDE.md` when it exists,
else note in the Stage 0 summary that no instruction file was found:

```markdown
- Reusable code index: `docs/reuse-catalog.md` — check it before creating a helper, component, hook, or test factory.
```

Add the pointer once; an instruction file that already points at the catalog
stays as it is.

### 5. Grill the reuse choices

Survey facts settle themselves and feed the Reuse Plan in Stage 1. A choice with
real alternatives joins the grilling frontier as a numbered question with a
recommended answer:

- extend an existing module, or build a new one beside it;
- share logic across stories, or keep look-alike code separate because it changes
  for different reasons;
- whether a named upcoming feature will consume a module this feature builds —
  the one way a single-consumer module becomes shared now (the user decides; the
  default is a candidate).

### 6. Report

The Stage 0 pause summary lists the catalog changes: entries added, corrected,
and removed; areas surveyed; bootstrap and pointer, when they happened.

## Stage 1 — Reuse Plan

Write `### Reuse Plan` under the spec's Implementation Decisions. Name every
module by its bare symbol — greppable, and free of file paths, keeping
`to-spec`'s rule. Each reusable module the spec touches lands in exactly one
category:

- **Use as-is** — `symbol` → the user stories that use it.
- **Extend** — `symbol`, the interface change, whether existing callers change →
  stories.
- **Create shared** — `symbol`, its interface (signature, invariants, error
  modes), the named consumers, and a use-when. The interface covers every
  consumer's need, so the owner ticket builds it once and no consumer writes a
  variant.
- **Create candidate** — `symbol`, a feature-agnostic interface, the plausible
  second use, and a use-when.
- **Promote** — a catalog candidate's `symbol` and its new consumer; Stage 3
  turns it into a prefactor ticket.
- **Kept separate on purpose** — the look-alike pair and why they change for
  different reasons.

### The create-shared bar

A new module is **create shared** only when one of these holds:

- two or more user stories in this spec consume it;
- one existing caller plus one story in this spec consume it;
- the user confirmed in Stage 0 that a named upcoming feature will consume it.

Every other reusable-looking module is a **create candidate** — designed for
extraction: built inside the feature with an interface free of the feature's own
types, catalogued as a candidate once its ticket is integrated, and promoted by
the later feature that brings the second consumer.

### Example

```markdown
### Reuse Plan

- **Use as-is:** `formatCurrency` → stories 3, 7
- **Extend:** `DataTable` — add `selectable` and `onSelectionChange`; existing callers unchanged → stories 2, 4
- **Create shared:** `buildReportRows(report, filters): Row[]` — pure; rows in display order; throws `EmptyReportError` for a report with no line items — consumers: story 2 (Excel), story 5 (CSV) — use for: turning a report into export rows
- **Create candidate:** `downloadBlob(blob, filename)` — plausible second use: any file download — use for: triggering a browser download
- **Promote:** none
- **Kept separate on purpose:** import vs export validation — import guards untrusted files, export guards our own data; they change for different reasons
```
