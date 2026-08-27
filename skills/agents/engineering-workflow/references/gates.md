# Gates

## Stable reports

Keep one file per review kind and update its cycle section. Do not create a new
file for every retry. Register the new fingerprint after each update.

Each report records cycle number, reviewed Git ref/diff fingerprint, inputs,
findings with evidence, unresolved blocker identities, verdict, and validation
commands. A blocker identity should remain stable across cycles so persistent
findings can be detected.

## Design scrutinize normalization

- `SHIP`: intent and design are sufficient; continue to planning.
- `FIX_THEN_SHIP`: bounded correction that does not change the chosen design;
  update specification and re-review.
- `REWORK`: the approach or a major seam is unsound; return to specification or
  exploration.
- `REJECT`: the proposed change should not proceed; return to discovery.

`scrutinize` is a blocking gate, not an advisory comment. Normalize upstream
wording into these four outcomes before routing. `SHIP` is the only passing
outcome. `FIX_THEN_SHIP`, `REWORK`, and `REJECT` all keep the gate open until
the required route completes and a later scrutinize review returns `SHIP`.

Only a completed scrutinize review consumes a cycle. Editing a spec, prototype,
or implementation between reviews does not. Persist the compact fields
`cycleNumber`, `verdict`, `blockingFindings`, `newFindings`,
`resolvedFindings`, `repeatedFindings`, `changedArtifacts`, `reasonForRetry`,
and `reviewRef`; keep the full report in the stable review artifact.

For `FIX_THEN_SHIP`, identify the violated invariant, verify the evidence, and
make the smallest correct change. A recommendation such as “use a distributed
lock” is not an instruction to install Redis or copy an implementation.

For `REWORK`, route to the stage responsible for the failed assumption. Usually
that is `SPECIFICATION`; unresolved empirical or external uncertainty first
uses the needed external `prototype` or `research` dependency. For `REJECT`,
return to `DISCOVERY` or an explicit human/product decision. Do not turn either
verdict into a local patch, and do not reset the current gate counter on a
backward transition.

## Code normalization

A finding blocks when evidence shows a spec mismatch, missing behavior, wrong
behavior, regression risk without a required test, or violation of a documented
repository standard with a concrete consequence. A style preference or smell
without consequence is non-blocking.

Code review has two axes: behavior/spec compliance and code quality/standards.
The reviewed runtime must support the specialist's required subagents. A
single-axis substitute is incompatible and causes `BLOCKED`.

Any blocking result consumes one code cycle and returns to
`IMPLEMENTATION[REVIEW_FIX]`.

## System normalization

Trace the actual execution path around the diff: entrypoint, validation,
contracts, state mutation, retries, concurrency, partial failure, external side
effects, observability, recovery, and exit. Findings require path/evidence and a
concrete consequence.

A blocking result consumes one system cycle, returns to implementation, and
requires tests/typecheck plus code review again before system re-review. A
system `REWORK` may return farther back to specification/design; the current
system gate counter is retained.

## Independent budgets and progress

`MAX_SCRUTINIZE_CYCLES = 6`. Design and system scrutinize each have an
independent six-cycle budget. Code review retains its separate three-cycle
budget. Passing one gate never resets another gate's count.

If a design or system review is still non-`SHIP` on cycle 6, persist
`GATE_BUDGET_EXHAUSTED` as `BLOCKED`; never start cycle 7. Stop earlier with
`SCRUTINIZE_NO_PROGRESS` when the same blocker survives consecutive revisions
without useful new or resolved findings, when the decision is human-owned, or
when required evidence/runtime capability is unavailable. A fresh six-cycle
series requires explicit human authorization and a materially new solution.

The design and system counters are persisted as both the stage-scoped aliases
`designScrutinizeCycles`/`systemScrutinizeCycles` and the corresponding
`gateCycles` entries. They are never shared.
