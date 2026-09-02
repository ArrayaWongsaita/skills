# agy-implement — Design Review

Scrutinize pass against [spec.md](spec.md). One stable report, updated per cycle.

## Cycle 1

### 1. Intent

Goal, in my words: *take a directory of `grill-to-tickets` tickets and turn it into
working code by farming each ticket to a headless `agy` worker — serial when the
dependency graph or predicted file overlap says so, parallel-in-worktrees otherwise —
with TDD forced on every ticket, the orchestrator verifying each result, per-wave
integration, one commit per ticket, stopping before review, resumable.*

The problem is real and load-bearing: the owner hits single-provider quota on large
ticket sets and wants token spend spread across providers.

**Mandatory simpler-alternative pass:** the *stated purpose* — provider distribution
(adr/0003) — is fully delivered by a **serial** round-robin loop over `agy` with no
worktrees, no touch-set prediction, and no integration gate. Parallelism serves
throughput, which was explicitly demoted in discovery (Q2). v1 nonetheless builds the
entire parallel apparatus. A serial-only v1 would be ~70% less mechanism for the same
stated goal, with parallelism as v2. This was chosen deliberately at Q6, but the spec
should carry one explicit "considered serial-only, rejected because …" paragraph rather
than leaving the trade-off silent. See finding 3.

### 2. Trace (proposed flow against reality)

- **Worker → integration.** Integration gate says "merge each verified worktree branch
  into the integration branch". Worker constraints (story 20, decisions) say the worker
  must **not** commit. You cannot `git merge` an uncommitted worktree, and you cannot
  `cherry-pick` without a commit. The mechanic is undefined at its most load-bearing
  point. → finding 1 (blocker).
- **Worktree dependencies.** A fresh `git worktree` has no `node_modules`. Verification
  and the integration suite run in the worktree. Running `npm install` per worktree is
  slow × N and rewrites the lockfile — which the spec itself lists as a cross-cutting
  file that forces serialization. No dependency strategy is specified. → finding 2
  (blocker).
- **Round-robin vs concurrency.** Assignment is `list[N mod len]` by ticket ordinal N.
  With a 2-entry list and concurrency 4, wave 0 dispatches two simultaneous calls to the
  same provider — the exact rate-limit burst the skill exists to prevent. Distribution
  should be by dispatch slot, not ticket ordinal. → finding 5 (major).
- **TDD red state.** The orchestrator independently re-runs the *green* tests but takes
  the worker's pasted *red* output on trust (verification gate step 1, story 25). The
  worker could fabricate it. The one guarantee the owner most wants ("วัดผลที่ต้องการได้
  ถูกต้อง") is partly trust-based. → finding 4 (major).
- **Touch-set prediction.** An LLM predicting a ticket's file writes *before*
  implementation, accurately enough to gate parallel-safety, is unreliable. The
  integration gate + orchestrator conflict resolution is the real safety net and runs
  regardless. Prediction may be a planning sub-system that adds cost and false
  confidence without changing outcomes. → finding 6 (major).
- **Resume "rewind".** "Rewind to the earliest ticket whose reality no longer holds" —
  on an integration branch with commits, rewind means a destructive `git reset` that
  also drops downstream commits. Mechanic and blast radius unspecified (inherited
  hand-wave from `engineering-workflow`). → finding 8 (minor).
- **Upstream seams.** Story 26 leans on the parent spec's Testing Decisions naming a
  per-ticket seam. The `to-spec` template produces *module-level* testing decisions, not
  per-ticket seams, so "orchestrator-chosen at planning" will be the common path, not
  the exception. Not wrong, just mis-weighted. → finding 9 (nit).
- **`agy` failure envelope.** `status` values for failure/timeout are unknown (probe 1).
  The verification and failover sections are written in full detail as if known. The
  spec should mark those specific numbers/tokens as provisional. → finding 10 (nit).

### 3. Verify (claims)

- "Parallelism is best-effort with a sequential safety net" — **holds.** Integration
  gate runs the full suite per wave; orchestrator owns conflict resolution.
- "Orchestrator never implements (adr/0002)" — **mostly holds**, but story 34 has the
  orchestrator resolving a merge conflict that "reveals a real design collision" by
  replanning; deciding how two tickets share a contended module *is* a design/impl call
  made on the main thread. The boundary is fuzzier than adr/0002 states. → finding 7
  (minor).
- "TDD ⇒ the result is trustworthy" — **partially holds**; green is verified, red is
  trusted. → finding 4.

### 4. Findings

**1 — blocker — The worktree→integration mechanic contradicts the "worker does not
commit" rule.**
Why it matters: this is the core of Stage 1; implementation cannot proceed without it.
Evidence: integration gate step 1 ("merge each verified worktree branch") vs worker
constraint "do not commit/push/PR". An uncommitted worktree cannot be merged or
cherry-picked.
Suggested change: pick one and write it into the spec — (a) the worker commits freely
in its own worktree branch and the orchestrator squash-merges to one commit per ticket
at the integration gate (recommended; keeps "one commit per ticket" as an integration
property, not a worker rule), or (b) the orchestrator commits in the worktree on the
worker's behalf after verification. Keep "no push / no PR" as the real constraint.

**2 — blocker — No dependency strategy for parallel worktrees.**
Why it matters: verification and the integration suite run in the worktree; without deps
they fail immediately; `npm install` per worktree is slow and rewrites the lockfile the
spec treats as cross-cutting.
Evidence: "Independent re-run of the ticket's new/changed tests passes; typecheck
passes" runs in "the ticket's tree"; worktrees are created empty.
Suggested change: specify it — symlink or reflink `node_modules` from the primary
checkout into each worktree (read-only reuse), and forbid workers from running package
installs (a ticket that needs a new dependency is a planning conversation, consistent
with adr/0002/0004). Note the equivalent for other ecosystems.

**3 — major — The stated purpose is served without parallelism; the trade-off is
silent.**
Why it matters: v1 scope carries the riskiest machinery (worktrees, touch-set
prediction, per-wave integration, conflict resolution) for a throughput benefit that
discovery demoted.
Evidence: adr/0003 ("provider distribution is the purpose") + Q2 (throughput
secondary); a serial round-robin loop delivers adr/0003 in full.
Suggested change: either (a) add a "Rejected alternatives" paragraph to the spec
explaining why serial-only v1 was rejected despite serving the stated purpose, or (b)
actually split: v1 serial + round-robin, v2 adds parallel/worktrees. (a) is the minimal
fix if the owner still wants parallel in v1.

**4 — major — The TDD guarantee is half trust-based.**
Why it matters: "tests written every time so the outcome is measured correctly" is the
headline requirement; a fabricated or vacuous red step slips through green-only
re-runs.
Evidence: verification gate step 1 accepts the worker's returned red output; step 3
only re-runs green.
Suggested change: the orchestrator reproduces red itself — in the worktree, stash the
worker's non-test changes, run the new test files, confirm they fail, unstash. Cheap,
mechanical, and closes the gap. Add it to the verification gate.

**5 — major — Round-robin by ticket ordinal doesn't spread concurrent load.**
Why it matters: directly undercuts the rate-limit protection that is the skill's reason
to exist.
Evidence: `list[N mod len]` by ticket ordinal + concurrency cap 4 + short list ⇒
simultaneous same-provider calls.
Suggested change: assign the model when a worker slot is dispatched (round-robin over
the list by dispatch order), not when the ticket is numbered. Keep it shown in the Plan.

**6 — major — Touch-set prediction may be removable.**
Why it matters: a whole planning sub-system resting on an unreliable pre-implementation
LLM guess, when the deterministic safety net (integration gate) runs anyway.
Evidence: stories 6–8, Stage 0; integration gate catches the same collisions
after the fact.
Suggested change: consider dropping prediction. Run graph-independent tickets in
parallel by default; let the integration gate + orchestrator conflict resolution absorb
overlap. If kept, downgrade it from a gate to a hint ("likely-overlapping — consider
serializing") shown in the Plan for the owner to act on.

**7 — minor — adr/0002's "never implements" boundary is fuzzy at conflict resolution.**
Suggested change: one sentence in the spec — resolving a conflict that encodes a design
decision means stopping and surfacing the decision, not choosing it silently.

**8 — minor — Resume "rewind" is an unspecified destructive git operation.**
Suggested change: define it — rewind = reset the integration branch to the last commit
whose ticket still verifies, drop the worktrees for invalidated tickets, re-dispatch
from there; state that downstream commits are discarded and list them in the report
first.

**9 — nit — Story 26 over-weights upstream-spec seams.**
Suggested change: reword to "orchestrator selects the seam at planning, using the parent
spec's Testing Decisions as the primary input where they constrain it".

**10 — nit — Failover/verification detail is written as settled but rests on unrun
probes.**
Suggested change: mark the specific `status` tokens, timeout, and schema shape as
"provisional — confirmed by probe N" inline.

### Verdict

**FIX_THEN_SHIP** — the shape is right, the decisions are well recorded, and nothing
here needs re-grilling. But findings 1 and 2 are concrete gaps that block
implementation, and finding 4 undercuts the primary requirement. Biggest single reason:
**the worktree→integration mechanic is undefined and contradicts a worker constraint.**
Apply findings 1, 2, 4, 5 directly to the spec; address 3 with a rejected-alternatives
paragraph; 6 with a decision (drop or downgrade); 7–10 are cheap edits. Then re-review.

## Cycle 2

Owner ruling: F3 → (a) keep parallel in v1, record the trade-off. F6 → (b) touch-set is
an advisory hint, user decides at Plan approval.

### Findings applied to `spec.md`

| # | Fix landed |
|---|---|
| 1 | Workers commit freely on a per-ticket worker branch; integration gate **squash-merges** each verified branch as one commit in number order. "One commit per ticket" is now an integration property. "no commit" replaced with "commit on your branch; no push/PR". |
| 2 | Every ticket runs in its own worktree; worktrees reuse the primary checkout's deps by **symlink**; workers **may not run package installs** (new story 29); a ticket needing a new dep is replanned. `.scratch/<slug>/worktrees/` gitignored. |
| 3 | New **Rejected alternatives** section — serial-only v1 stated and rejected (throughput matters day one; worktree isolation also makes per-ticket red-reproduction clean; retrofitting parallelism later = core rework). |
| 4 | Verification gate step 2 = **orchestrator reproduces red itself** on a scratch checkout with only the test files applied. Worker's pasted red output is now corroborating evidence, not the check. New eval case 12. |
| 5 | Model assigned at **dispatch order**, not ticket number (adr/0003 updated). Plan has no model column; models land in `status.md` as workers start. New eval case 5. |
| 6 | Touch-set downgraded to an advisory **Plan flag** ("likely-overlapping — consider serializing"); user decides. Stories 6–8 rewritten; eval cases 3–4 rewritten; Out of Scope updated. |
| 7 | adr/0002 boundary sharpened in spec: a conflict that encodes a design decision → orchestrator **stops and surfaces**, does not resolve. New eval case 8. |
| 8 | Resume **rewind** defined: reset integration branch to last still-good commit, discard invalidated worktrees, list discarded commits first, re-dispatch. |
| 9 | Story 27 reworded — orchestrator selects the seam at planning, parent spec's Testing Decisions as primary input. |
| 10 | Worker-envelope section marks the failure/timeout `status` tokens as **provisional — confirmed by probe 1**. |

### Re-trace of the fixes

- **Squash-merge from a branch cut before earlier same-wave merges** — `git merge
  --squash` replays the diff onto the advanced integration branch; conflicts fall to
  finding 7's handling. Holds.
- **Reproduce-red with a committed worker branch** — step 2 now splits changed files
  from the return and applies only tests on a scratch checkout; no dependency on
  uncommitted state. Holds.
- **Dispatch-order round-robin + concurrency 4** — two concurrent slots now take
  distinct list entries as long as `len(list) ≥ 2`; a 1-entry list is single-provider by
  definition. Holds.

### Residual (non-blocking, tracked in Further Notes)

- Whether 4 concurrent ~45-min background `agy` processes are reliable under the host's
  background-Bash model is unverified — covered by validation probe 5 (two real parallel
  worktrees). Not a spec-shape risk.
- 3 of 6 validation probes (failure envelope, `--sandbox` capability, `--conversation`)
  are load-bearing for parameter values; all are listed and gate shipping, not the spec.

### Verdict

**SHIP** — both blockers closed, all four majors addressed, nits applied. The execution
mechanic (worker branch → squash-merge), the dependency strategy (symlink, no installs),
and the TDD guarantee (orchestrator reproduces red) are now concrete. Remaining unknowns
are explicitly scoped as pre-ship validation probes, not design gaps. Ready for Stage 3
(ticket breakdown).
