# Stage 0 — Planning procedure

Planning is read-only: resolve the feature, read its tickets, validate them,
and print a Plan. The run starts right after the Plan is printed.

## 1. Resolve and read the feature

- An explicit feature directory or `issues/` directory wins.
- A bare slug resolves to `.scratch/<slug>/`.
- Read every numbered ticket, the parent `spec.md` sections it cites, the
  feature `CONTEXT.md` and ADRs, and the repository decisions relevant to the
  ticket set.

Prompts, status files, branches, worktrees, and commits all wait for the first
dispatch.

## 2. Validate

```bash
node skills/agents/implement-tickets/scripts/plan.mjs <feature>/issues
```

The script returns JSON: per ticket the number, title, `blockers`, `touchSet`,
`seam`, `risk`, and `warnings`, plus the combined `warnings`.

Blockers must exist and have lower numbers, so ascending ticket number is the
run order. A missing blocker, forward blocker, cycle, malformed ticket, or
inconsistent numbering halts planning with the ticket and reference named.

Only `(edit)`, `(new)`, and `(edit from NN)` Context paths form the touch set.
A glob or an empty change set is an unknown touch set and raises a warning.

## 3. Seam and agent

Use each ticket's `**Seam:**` line verbatim. Without one, select the narrowest
public test seam from the parent spec's Testing Decisions that exercises the
acceptance criteria; a criterion with no isolated seam returns to planning for
decomposition.

Workers use `general-purpose` unless an available implementation-shaped agent
fits the ticket by name or description. The verifier is a fresh read-only
agent.

## 4. Print the Plan

One row per ticket, in ticket order:

| Ticket | Blockers | Touch set | Seam | Agent | Risk |
| --- | --- | --- | --- | --- | --- |

`Risk` is the script's `high` or `low`. A malformed or repeated Risk value reads
as `high` and carries the script's warning.

Also print every warning and the attempt budget from
[attempts](verification.md#attempts).
