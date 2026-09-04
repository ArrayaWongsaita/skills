# review-to-pr is engineering-workflow's §8–9 split out standalone

`engineering-workflow`'s `feature-flow.md` already describes phase 8 (two-axis
`code-review` from a fixed point, blockers routed to a review-fix loop, stop
after the third cycle) and phase 9 (conditional final `scrutinize`, its own
six-cycle budget, the `scrutinize → fix → tests → code-review → scrutinize`
sub-loop). A skill that drives an unreviewed integration branch to a PR-ready
state is exactly those two phases. It could be built as an
`engineering-workflow` delegate, reusing its state machine and gate accounting.

Decision: build `review-to-pr` as a fully standalone skill under
`skills/agents/review-to-pr/`, mirrored byte-identical to
`.agents/skills/review-to-pr/`, invoked directly as the step that runs after
`implement` / `agy-implement` / `subagent-implement` stop. It owns its own copy
of the review-loop, fix-dispatch, scrutiny-gate, review-point, and
state/resume machinery. It does not modify or depend on `engineering-workflow`,
`grill-to-tickets`, `agy-implement`, `subagent-implement`, any
`mattpocock/skills`-sourced file, or `skills-lock.json`.

Why: this mirrors ADR 0003 (`grill-to-tickets` split §1–3) and ADR 0005
(`subagent-implement` is §7) exactly. The owner may remove `engineering-workflow`
later; every standalone split so far has chosen zero coupling over reuse, so a
`grill-to-tickets → subagent-implement → review-to-pr` short path needs no
orchestrator and no dependency-registry entry. The repo ADR is
`docs/decisions/0006-review-to-pr-standalone.md`.

Trade-off: the code-review three-cycle budget, the scrutinize six-cycle budget,
the stall rule, and the `status.md` + Reality reconciliation discipline now
exist in a fourth place in the repo and can drift. A shared-`references/`
refactor across the three implement/review siblings is a deferred follow-up,
the same posture ADR 0004 and ADR 0005 take.
