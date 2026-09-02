# Agy Implement

Domain glossary for `agy-implement` (working name), a standalone skill that reads a
`grill-to-tickets` ticket set and drives implementation by dispatching worker agents,
serially or in parallel, then integrating and verifying the result.

## Language

**Orchestrator**:
The main agent (Claude Code) running this skill. It plans, dispatches workers, verifies
every result itself, integrates, and reports. It never hand-codes tickets that a worker
can take, and it alone resolves merge conflicts and routes skills.
_Avoid_: driver, controller, main thread

**Worker**:
A headless `agy` process the orchestrator hands exactly one ticket to, running against
an isolated copy of the workspace. A worker has zero context from the orchestrator's
conversation; its whole task must be self-contained.
_Avoid_: subagent, agent, agy (as a role name), delegate

**Step**:
One ticket. The unit the orchestrator dispatches and verifies. Not a sub-task inside a
ticket, and not a wave.
_Avoid_: task, chunk, unit of work

**Independent tickets**:
Two tickets in the same wave with no `Blocked by` edge between them — the candidates for
running at the same time. A touch-set overlap does not make them dependent; it only
raises an advisory flag in the Plan for the user to act on.
_Avoid_: unrelated tickets, parallel tickets, "งานไม่ config กัน" (the original informal phrasing)

**Touch-set**:
The set of files a ticket is estimated to create or modify, guessed during planning from
the ticket text, the parent spec, and a codebase look. An **advisory hint shown in the
Plan**, never an automatic gate: overlap or a cross-cutting file raises a
"likely-overlapping — consider serializing" flag; the user decides. The integration
gate, not the touch-set, guarantees correctness.
_Avoid_: blast radius, file scope, footprint

**Wave**:
The maximal set of tickets whose blockers are all satisfied by earlier waves. Wave 0
is every ticket with no blockers. The orchestrator executes one wave at a time.
_Avoid_: batch, round, layer, tier

**Verification gate**:
The per-ticket check the orchestrator runs before a ticket counts as done: it reproduces
the red state itself (sets the worker's non-test changes aside, runs the new tests, sees
them fail), re-runs them green, typechecks, and checks that every test maps to an
acceptance criterion with no vacuous assertions. Failing any part is a verification
failure and consumes a retry. The worker's returned red/green output is corroborating
evidence, not the check.
_Avoid_: ticket check, acceptance check, QA

**Integration gate**:
The checkpoint after every wave: merge each completed worker's branch into the
integration branch in ticket-number order, then run the full typecheck and test suite.
A wave is not done until its integration gate is green.
_Avoid_: merge step, sync point, checkpoint

**Test seam**:
The boundary a ticket's tests are written against, taken from the upstream spec's
Testing Decisions where it names one, or chosen by the orchestrator at planning and
shown in the Plan otherwise. The worker is handed its seam and tests there; it does not
pick its own.
_Avoid_: test boundary, interface, injection point, mock point

**Provider distribution**:
The reason workers exist: spreading a run's tickets across several LLM providers
(Claude, Gemini, GPT-OSS via `agy`) so that no single provider's quota or rate limit
becomes the bottleneck for a multi-ticket job. Opt-in through the `Model list`; with no
list a run uses `agy`'s single default model.
_Avoid_: load balancing, cost saving, model routing, fan-out

**Model list**:
An optional flat list of `agy` model ids passed once at run start. The orchestrator
assigns a model to each worker **at dispatch time** by round-robin over dispatch order
(not ticket number), with no judgement about which ticket suits which model. With no
list, every worker runs `agy`'s own default model. The skill never reasons about model
choice per ticket.
_Avoid_: provider pool, capability floor, weight tier, model routing

**Plan**:
The approved artifact produced by Stage 0: the wave table, each ticket's predicted
touch-set, its serial/parallel disposition, and its provider assignment. The
orchestrator mutates no source before the user approves the plan.
_Avoid_: schedule, blueprint, execution plan

**Failover**:
Re-running a ticket when its worker's provider rate-limits, times out, or crashes: on
the next model in the run's list, or the same default model again if there is no list.
Failover has its own budget, separate from verification retries — a provider outage is
not the ticket's fault.
_Avoid_: retry, fallback, provider switch

**Integration branch**:
The single branch a run assembles verified ticket work onto. Each ticket is worked on
its own **worker branch** in a worktree cut from the integration HEAD; the integration
gate squash-merges each verified worker branch back as exactly one commit, in
ticket-number order. "One commit per ticket" is a property of this merge, not a worker
rule — workers commit freely on their own branch.
_Avoid_: feature branch, working branch, trunk
