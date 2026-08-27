# Feature Flow

## Normal feature

1. Classify as `FEATURE`; audit the dependencies required for the selected
   route.
2. Run the installed `grill-with-docs` skill. On Claude, save state as
   `BLOCKED/USER_INVOCATION_REQUIRED` and hand the user `/grill-with-docs`.
3. Route typed unknowns to installed `research` or `prototype`; return to
   `SPECIFICATION` only after the evidence artifact exists.
4. Run installed `to-spec`, then register its published spec reference.
5. Run installed `scrutinize` as the blocking design gate. Count one cycle for
   each completed review, persist the compact progress fields, and normalize
   the result to `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or `REJECT`. `SHIP`
   proceeds; `FIX_THEN_SHIP` fixes the verified finding and re-reviews;
   `REWORK` goes back to specification/exploration; `REJECT` goes to discovery
   or a human/product decision. The design gate has an independent maximum of
   six cycles, with no automatic cycle 7 and an earlier no-progress stop.
6. On `SHIP`, run installed `to-tickets`; do not decompose tickets in this
   skill.
7. Run installed `implement`, exposing its source-defined commit side effect
   before a user-only handoff or explicit Codex load.
8. Run installed two-axis `code-review` from a fixed point. Route blockers to
   `IMPLEMENTATION[REVIEW_FIX]` and stop after the third code cycle.
9. Run final `scrutinize` only when risk or change characteristics require the
   system gate. Its six-cycle counter is independent of design. For every
   fixable final finding, use `scrutinize -> implementation fix -> tests or
   typecheck -> code-review -> scrutinize`; never skip the repeated code review.
   Complete only after verification and all required gates pass.

## Reduced feature

Use only when the request has explicit acceptance behavior, LOW risk and
uncertainty, one known local seam, and no architecture/abstraction/assumption
or system-sensitive change. Register an acceptance/spec artifact, then use
`implement` -> `code-review` -> `COMPLETE`.

The orchestrator owns only the predicate and transitions; the installed skills
own alignment, specification, implementation, and review method.
