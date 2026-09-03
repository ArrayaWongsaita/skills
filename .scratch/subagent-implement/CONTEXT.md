# Subagent Implement

Domain glossary for `subagent-implement`, a standalone skill that reads a
`grill-to-tickets` ticket set and drives implementation by dispatching the
harness's own subagents — one per ticket, serially in dependency order — so the
main agent's context is not spent on implementation, then verifying and
integrating one commit per ticket.

## Language

**Orchestrator**:
The main agent running this skill. It plans, dispatches a worker and a verifier
per ticket, judges the two reports itself, squash-merges, and reports. Its own
steps stay text-only; it hand-codes nothing a worker can take, and it alone
resolves merge conflicts and makes the pass / retry / BLOCKED call.
_Avoid_: driver, controller, main thread

**Worker**:
One native harness subagent the orchestrator hands exactly one ticket to, running
in its own git worktree with zero context from the orchestrator's conversation.
Dispatched through the Agent / Task tool, never as a `fork` (a fork would inherit
the orchestrator's context and model). Its whole task is in its prompt.
_Avoid_: agy, external process, the model, delegate

**Verifier**:
A fresh `Explore` subagent the orchestrator dispatches per ticket to do the
I/O-heavy checks — reproduce the red state, run the tests green, run the
typecheck and the full suite — and return raw evidence. It renders no verdict;
the orchestrator judges from its evidence.
_Avoid_: QA, reviewer, checker (as a role name), second worker

**Ticket**:
One unit of work from the `to-tickets` local format. The unit the orchestrator
dispatches, verifies, and squash-merges — one commit each.
_Avoid_: task, chunk, story, step

**Dependency order**:
A topological ordering of the ticket set derived from the `Blocked by` edges.
Where ticket numbering is valid, ascending ticket number is a valid dependency
order and the two terms mean the same thing. v1 runs the tickets one at a time in
this order.
_Avoid_: wave, batch, schedule, execution plan

**Frontier**:
Every ticket whose `Blocked by` set is fully satisfied by tickets already
integrated. The run takes the next frontier ticket in dependency order.
_Avoid_: ready set, queue, backlog

**Test seam**:
The boundary a ticket's tests are written against, taken from the parent spec's
Testing Decisions where it names one, or chosen by the orchestrator at planning
and shown in the Plan otherwise. The worker is handed its seam and tests there.
_Avoid_: test boundary, interface, injection point, mock point

**Agent match**:
The rule that resolves which `subagent_type` a worker runs as: a run-level
`--agent` pin wins; otherwise the orchestrator picks an implementation-shaped
agent from the environment by a name/description wording match, falling back to
`general-purpose` then `claude`. No per-ticket reasoning about which agent suits
which ticket.
_Avoid_: agent routing, capability match, agent selection logic

**Plan**:
The approved artifact from Stage 0: the ticket table in dependency order, and per
ticket its blockers, test seam, matched agent, and retry budget. No model column.
The orchestrator mutates no source before the user approves it.
_Avoid_: schedule, blueprint, wave table

**Integration branch**:
The single branch a run assembles verified ticket work onto:
`subagent-implement/<feature-slug>`. Each ticket is built on its own **worker
branch** `subagent-implement/<feature-slug>/<NN>` in a worktree cut from the
integration `HEAD`; a verified worker branch is squash-merged back as exactly one
commit in dependency order. "One commit per ticket" is a property of that merge,
not a worker rule.
_Avoid_: feature branch, working branch, trunk

**Verification failure**:
The orchestrator's judgment finding a gap in the verifier's evidence — a test
missing, not actually red first, still red, vacuous, or not covering a
criterion — or a malformed worker return. It resumes the same worker via
`SendMessage` with the specific detail and consumes one of
`MAX_TICKET_ATTEMPTS = 3`.
_Avoid_: test failure, QA fail, bounce

**BLOCKED**:
A ticket that fails the orchestrator's judgment three times
(`TICKET_VERIFICATION_FAILED`) or whose integration conflict encodes a design
decision. It halts only its own dependency branch; independent tickets are
reported as an available partial path.
_Avoid_: failed, stuck, abandoned

**Context discipline**:
The rule that the orchestrator's own steps are text-only — parse, build the DAG,
write prompts, read the two reports, judge, squash-merge, write `status.md`.
Reading implementation files, running tests, and running the suite happen inside
subagents. The one exception is the fallback test run when a verifier errors.
_Avoid_: context budget, token saving, offloading
