# Stage 0 — Planning procedure

Planning is read-only. Resolve the feature argument, load its ticket files and
planning context, validate the ticket set, calculate waves, and present a Plan.
Pause for explicit approval before dispatching or changing any file outside the
feature directory.

## 1. Resolve and read the feature

- An explicit feature directory or `issues/` directory wins.
- A bare slug resolves to `.scratch/<slug>/`.
- Pass the resolved `issues/` directory to `scripts/waves.mjs`.
- Read every numbered ticket, the parent `spec.md` sections it cites, the
  feature `CONTEXT.md` and ADRs, and the repository decisions relevant to the
  ticket set.

Do not create prompts, reports, status files, branches, worktrees, or commits
during planning. The wave script only reads ticket files and the optional
parallel-validation marker.

## 2. Parse and validate tickets

For each `NN-<slug>.md`, record its number, title, `Blocked by`, `Seam`, and
`Context` fields. Resolve blockers by ticket number or exact ticket title.
Blockers must exist and have lower numbers; a missing blocker, forward blocker,
cycle, malformed ticket, or inconsistent numbering halts planning with the
specific ticket and reference named.

The ticket checker uses middle-dot-separated Context items. Only `(edit)`,
`(new)`, and `(edit from NN)` paths form the touch set. Plain and `(from NN)`
items and `spec §` references are read-only. Normalize declared paths and sort
them before reporting. A glob or an empty declared change set is unknown and
raises a warning.

## 3. Compute waves

Run:

```bash
node skills/agents/implement-tickets/scripts/waves.mjs <feature>/issues \
  [--serial] [--concurrency N] [--marker <file>]
```

The script places tickets in ascending ticket order. A ticket's wave is after
every blocker's wave and is the earliest eligible wave without a touch-set
overlap. Paths overlap when they are equal or one is a directory prefix of the
other. The directory-prefix rule is defensive: the checker rejects directory
Context paths, so the contract fixture labels that overlap case unreachable
from checker-valid ticket sets.

A ticket with an unknown touch set receives an otherwise empty wave, and no
later ticket joins that wave. Later tickets still obey blocker waves and touch
overlap. `--serial` assigns each ticket its own wave in ticket order.
`--concurrency N` is echoed in the JSON output and does not change the waves;
the orchestrator enforces the cap across workers and verifiers.

The output is JSON with `waves`, per-ticket `wave`, `blockers`, `touchSet`,
`budget`, and `warnings`, the `concurrency` value, and `parallelValidated`.
The marker is
`references/parallel-validation.md` by default and can be replaced with
`--marker <file>` for a fixture. A line `status: not validated` makes
`parallelValidated` false. A line `status: validated <date>` makes it true.

## 4. Select the seam and match the agent

Use each ticket's `**Seam:**` line verbatim when present. If it is absent, use
the parent spec's Testing Decisions to select the narrowest public test seam
that exercises the ticket's acceptance criteria, and record that seam. A
criterion with no isolated test seam returns to planning for decomposition.

Use an explicitly requested `--agent` pin for native workers. Otherwise match
an available implementation-shaped agent by its name or description, falling
back to `general-purpose`. The verifier is a fresh read-only agent, not the
orchestrator. Record the matched worker agent for each ticket.

## 5. Present the Plan and pause

Present one row for every ticket, in ticket order:

| Ticket | Wave | Blockers | Budget | Touch set | Seam | Matched agent | Retry budget |
| --- | ---: | --- | --- | --- | --- | --- | ---: |

The Budget column shows the text after each ticket file's own Budget field
label, or `none` when that field is absent. It is information only and applies
no limit or triage.

Also state:

- backend: native harness subagents by default, or the selected `--with`
  adapter;
- concurrency cap: `4` by default or the supplied `--concurrency N`;
- all script and planning warnings, including unknown touch sets;
- the standalone line `parallel not yet validated` when the marker says
  `status: not validated`;
- retry budget: three ticket attempts, unless the run contract later defines
  a narrower infrastructure retry.

Pause for explicit approval after presenting the Plan. No file outside the
feature directory changes until approval. On requested adjustments, update the
Plan and ask for approval again; do not start execution based on silence.
