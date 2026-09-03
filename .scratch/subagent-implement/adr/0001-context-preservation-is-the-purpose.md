# Workers exist to keep the orchestrator's context lean, not to spread provider spend

`subagent-implement` dispatches a ticket to a native harness subagent so that the
file reads, edits, and test runs that implementing the ticket requires happen in
the subagent's context window rather than the orchestrator's. Only the worker's
final report and the verifier's evidence cross back. The driving constraint is
the main agent's context budget: a multi-ticket run driven inline fills the
orchestrator's window with implementation detail and degrades its planning and
judgment.

This is the opposite reason from `agy-implement`, whose workers exist for
provider distribution (its feature ADR 0003). Cost and wall-clock time are not
the point here either — a serial run of subagents is not faster than doing the
work inline, and may be slower.

Consequences: the orchestrator's own steps are held to text-only work — parsing,
DAG building, prompt writing, reading two compact reports per ticket, judgment,
squash-merge, `status.md`. The verifier exists so that even the red-state
reproduction and the suite run stay out of the orchestrator's context. The one
sanctioned exception is a single fallback test run when a verifier errors.

Trade-off: a subagent re-derives the ticket's context from its prompt every time,
so the self-contained prompt scaffold matters as much as it does for
`agy-implement`.
