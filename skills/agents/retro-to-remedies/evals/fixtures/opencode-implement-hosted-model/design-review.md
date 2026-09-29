# Design Review — opencode-implement-hosted-model

Gate: `scrutinize`, run inline per `grill-to-tickets` Stage 2, against
`spec.md`. Budget: 6 cycles max.

## Cycle 1 — FIX_THEN_SHIP

**Intent check.** One sentence: move `opencode-implement` from local/criterion-
decomposed/serial to hosted-model/whole-ticket/wave-parallel, mirroring
`agy-implement`'s execution shape, while keeping its own automatic
native-subagent fallback tier and its single-model-per-run boundary.
Simpler-alternative pass: "merge into `agy-implement` as `--engine
opencode|agy`" was already surfaced and explicitly declined by the user at
Stage 0 (recorded in spec's Rejected Alternatives) — not re-litigated here,
since it's a decision that was made, not one nobody made.

Traced: the spec's Implementation Decisions against all 4 new ADRs; the
original shipped `opencode-implement` (`SKILL.md` + every file under
`references/`); `agy-implement`'s `planning.md`, `worktree-integration.md`,
`status-and-resume.md`, `agy-contract.md`.

### Findings

1. **[Blocker] Model resolution not captured-and-pinned.** `spec.md` §Solution
   / §"opencode worker contract" — every worker omitted `--model` unless the
   user gave one, meaning every dispatch across the whole run independently
   re-resolved via `opencode`'s own last-used/config chain. Nothing prevented
   drift mid-run (a model switch in the user's own `opencode` session, or any
   other process on the same machine, between ticket dispatches), silently
   contradicting the spec's own stated invariant ("one resolved model for the
   whole run") and ADR 0001's "at the start of a run" wording. **Fix applied**:
   resolve once before wave 0, capture the value, pass it as an explicit
   `--model` to every subsequent worker for the rest of the run.
2. **[Major] Per-wave integration gate vs. mid-wave fallback escalation
   unspecified.** A literal "integrate once every ticket in the wave has
   passed" blocks the whole wave's integration — and the next wave's start —
   on the slowest ticket's fallback dispatch (a second subagent run,
   potentially 15–30+ min), defeating the throughput reason for adopting
   parallel dispatch at all. **Fix applied**: integration is now per-ticket,
   as each clears; only the *next wave's start* still waits on every ticket in
   the current wave reaching a terminal state.
3. **[Major] Retry carry-over scoped too broadly.** "Resume the same session"
   read as covering both verification failures and `opencode`-process
   failures, but a crashed/timed-out/stall-killed session may not exist or be
   resumable (no `sessionID` if killed before the first event) —
   `agy-implement` itself splits this exact way (`MAX_TICKET_ATTEMPTS`
   resumes, `MAX_FAILOVER_ATTEMPTS` redispatches fresh). **Fix applied**:
   scoped resume to verification failures only; `opencode`-process failures
   keep the fresh-dispatch pattern unchanged from the shipped skill.
4. **[Minor] File list incomplete.** Implementation Decisions never named
   `references/decomposition.md` (wholly obsolete, no `agy-implement`
   equivalent) or `references/prompt-scaffold.md` (needs converting from
   per-sub-step to whole-ticket shape). **Fix applied**: added an explicit
   "Files touched" table naming both, plus every other `references/` file and
   its disposition.
5. **[Nit, not blocking]** `TICKET_TOO_LARGE_FOR_CONTEXT` has no more
   planning-time detection (no context-budget estimate exists); it can now
   only surface as a runtime `opencode` error, indistinguishable from a
   generic failure unless `opencode`'s error event says otherwise — same end
   state either way (falls back after burning its retry budget), just
   possibly slower. **Fix applied**: added to the validation-probes list as a
   probe to run, not a spec change.

**Verdict: FIX_THEN_SHIP.** All four actionable findings have a fix derivable
directly from the ADRs' own stated intent or from `agy-implement`'s already-
adopted precedent — no new decision nobody made, so no return to Stage 0.

## Cycle 2 — re-review after fixes

Fixes applied directly to `spec.md` (Solution, worker contract, Stage 1
Implementation Decisions, User Stories 17/23/24/30, Testing Decisions eval-case
list) and backfilled into `adr/0001-hosted-only.md` and
`adr/0002-whole-ticket-wave-parallel.md` so the ADRs stay the authoritative
record. Consistency sweep (`grep` for the old "per-wave integration gate" /
"once every ticket in the wave" / plain "resume the same session" phrasing)
found and corrected two additional stale spots the first edit pass missed:
User Story 24 and the Testing Decisions eval-case list still described the
literal per-wave batch integration gate.

Re-checked all 5 findings against the edited text:

1. Model pin — §Solution now resolves once and pins; User Story 17 restated;
   ADR 0001 Consequences rewritten from "visible" to "mechanically prevented."
2. Integration-vs-fallback — §Solution, §Stage 1 Implementation Decisions,
   User Story 24, and the eval-case list now consistently describe per-ticket
   integration gated only by terminal state, with the wave boundary gating
   only the *next* wave's start; ADR 0002 carries the same text.
3. Retry scoping — worker-contract section now states both rules explicitly;
   User Stories 23 and 30 each state their own case; ADR 0002 carries the same
   split.
4. File list — new table present, all 7 `references/` files accounted for.
5. Probe added to Further Notes.

No new issues surfaced in the re-check; no finding was left half-applied.

**Verdict: SHIP.**
