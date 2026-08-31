# Grill To Tickets

Domain glossary for `grill-to-tickets`, a standalone composite skill that carries an idea from a relentless interview through to published, ticket-ready work.

## Language

**grill-to-tickets**:
A composite skill that inline-executes `grilling`, `domain-modeling`, `to-spec`, `scrutinize`, and `to-tickets` in sequence, stopping once tickets are published. It does not implement.
_Avoid_: mini engineering-workflow, spec-to-tickets

**Design Review Gate**:
The bounded review loop where `scrutinize` evaluates the published spec and returns one of four verdicts (`SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`), gating entry to ticket breakdown.
_Avoid_: design gate, spec check

**Gate Budget**:
The maximum number of Design Review Gate cycles (6) before the loop must stop and ask a human to authorize a fresh budget. A completed `scrutinize` review consumes one cycle; editing the spec between reviews does not.
_Avoid_: retry limit, max attempts

**Spec-level Rework**:
A `REWORK` verdict whose finding traces to how the spec is written (a seam is unclear, a user story is missing) rather than to a decision no one has made. Resolved by re-running `to-spec`, without leaving the Design Review Gate.
_Avoid_: minor rework, spec fix

**Decision-level Rework**:
A `REWORK` verdict whose finding traces to a decision `to-spec` cannot synthesize because it was never made. Resolved by returning to the grilling stage, not by re-running `to-spec`.
_Avoid_: major rework, deep rework

**Stall**:
The condition where the same blocking finding survives two consecutive Design Review Gate cycles with no new or resolved findings. A stall stops the loop early, before the Gate Budget is exhausted.
_Avoid_: no progress, deadlock
