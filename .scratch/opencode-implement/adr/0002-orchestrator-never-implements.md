# The orchestrator never implements a ticket, and it is the verification authority

Every ticket is built by a worker — local `opencode run` processes, one per sub-step,
or, on fallback, a single native subagent for the whole ticket. The orchestrator's own
actions stay to: parsing tickets, building the dependency DAG, building each ticket's
step plan and estimating sub-step sizes, writing worker prompts and progress notes,
running the verification gate, squash-merging, and writing `status.md`. It writes implementation code itself **only** to resolve a purely
mechanical merge conflict (import order, adjacent edits, a moved block). A merge conflict
that encodes a design decision — which module owns a shared contract, which schema shape
wins — halts the run with `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and is surfaced, not
resolved silently. A ticket no worker can finish within its retry budget becomes
`BLOCKED`; the orchestrator does not hand-code it to rescue the run.

Verification is run by the orchestrator, not delegated to a verifier subagent (this is
the divergence from `subagent-implement`). The rationale: the whole point of the skill is
trusting a cheap local model's output, so a capable, independent checker — the
orchestrator (Claude) — reproducing the red state and running the suite itself is the
right trust anchor. And the worker is already an external process, so its file reads and
test runs never entered the orchestrator's context in the first place — there is no
context-cost argument for a separate verifier here.

This mirrors `agy-implement` feature ADR 0002.
